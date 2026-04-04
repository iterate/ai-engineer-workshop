/**
 * A fuller agent loop built on the native OpenAI Responses API.
 *
 * This keeps forwarding every streamed OpenAI event into the iterate stream, but
 * also executes local function tools, feeds tool outputs back into the model, and
 * continues for multiple turns until the model stops asking for tools.
 *
 * Run with `pnpm workshop run` and select this script.
 * Override `BASE_URL`, `WORKSHOP_PATH_PREFIX`, `STREAM_PATH`, or `OPENAI_MODEL`
 * if needed.
 */
import { randomBytes } from "node:crypto";
import OpenAI from "openai";
import type {
  EasyInputMessage,
  FunctionTool,
  ResponseInput,
  ResponseInputItem,
  ResponseInputText,
  ResponseFunctionToolCall,
  ResponseOutputItemDoneEvent,
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import {
  createEventsClient,
  defineProcessor,
  type JSONObject,
  PullSubscriptionProcessorRuntime,
} from "ai-engineer-workshop";
import { z } from "zod";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_AGENT_TURNS = 6;
const MAX_FETCH_BODY_CHARS = 20_000;

const SYSTEM_PROMPT = [
  "You are a helpful assistant inside a workshop demo.",
  "Use the fetch_url tool whenever you need current web content or API responses.",
  "Prefer grounding factual claims in fetched data instead of guessing.",
  "Keep final answers concise and include the URLs you used when relevant.",
].join(" ");

const UserMessagePayload = z.object({
  content: z.string().min(1),
});

const HistoryItemsAddedPayload = z.object({
  items: z.custom<ResponseInput>(),
});

const FetchUrlArgs = z.object({
  url: z.url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
});

type AgentState = {
  history: ResponseInput;
  requestInProgress: boolean;
};

const openai = new OpenAI();

const tools: FunctionTool[] = [
  {
    type: "function",
    name: "fetch_url",
    description:
      "Make an HTTP request and return the response status, headers, and body text. " +
      "Use this to inspect websites or APIs before answering.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The absolute URL to request.",
        },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
          description: "HTTP method to use. Defaults to GET.",
        },
        headers: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Optional HTTP headers to send with the request.",
        },
        body: {
          type: "string",
          description: "Optional request body for non-GET requests.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
];

const agentProcessor = defineProcessor<AgentState>({
  initialState: {
    history: [],
    requestInProgress: false,
  },

  reduce: (state, event) => {
    if (event.type === "user-message") {
      const payload = UserMessagePayload.safeParse(event.payload);
      if (!payload.success) {
        return state;
      }

      const history: ResponseInput = [
        ...state.history,
        { role: "user", content: payload.data.content },
      ];
      return { history, requestInProgress: true };
    }

    if (event.type === "history-items-added") {
      const payload = HistoryItemsAddedPayload.safeParse(event.payload);
      if (!payload.success) {
        return state;
      }

      return {
        ...state,
        history: [...state.history, ...payload.data.items],
      };
    }

    if (event.type === "agent-loop-finished" || event.type === "agent-loop-failed") {
      return { ...state, requestInProgress: false };
    }
  },

  onEvent: async ({ append, event, state, prevState }) => {
    if (event.type !== "user-message" || prevState.requestInProgress) {
      return;
    }

    const payload = UserMessagePayload.safeParse(event.payload);
    if (!payload.success) {
      return;
    }

    console.log(`Input offset=${event.offset}`);

    try {
      await runAgentLoop({
        append,
        initialHistory: state.history,
      });
      console.log(`Done offset=${event.offset}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await append({
        type: "agent-loop-failed",
        payload: { message },
      });
      console.error(`Agent loop failed at offset=${event.offset}`, error);
    }
  },
});

export default async function openAiAgentProcessor(pathPrefix: string) {
  const baseUrl = process.env.BASE_URL || "https://events.iterate.com";
  const streamPath =
    process.env.STREAM_PATH ||
    `${normalizePathPrefix(pathPrefix)}/05/${randomBytes(4).toString("hex")}`;

  console.log(`\
Watching ${streamPath}

Open this in your browser and watch events appear live:
${new URL(`/streams${streamPath}`, baseUrl)}

Paste this JSON into the stream page input and submit it:
{
  "type": "user-message",
  "payload": {
    "content": "What is the title of the current top story on Hacker News? Use tools if needed."
  }
}
`);

  await new PullSubscriptionProcessorRuntime({
    eventsClient: createEventsClient(baseUrl),
    processor: agentProcessor,
    streamPath,
  }).run();
}

function normalizePathPrefix(pathPrefix: string) {
  return pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`;
}

function toJsonObject(value: unknown): JSONObject {
  const json = JSON.parse(JSON.stringify(value));
  if (json == null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Expected a JSON object payload");
  }
  return json as JSONObject;
}

async function runAgentLoop({
  append,
  initialHistory,
}: {
  append: (event: { type: string; payload: JSONObject }) => Promise<void>;
  initialHistory: ResponseInput;
}) {
  let history = [...initialHistory];

  for (let turn = 1; turn <= MAX_AGENT_TURNS; turn += 1) {
    await append({
      type: "agent-turn-started",
      payload: { turn },
    });

    const responseItems = await streamResponseTurn({ append, history, turn });

    if (responseItems.length > 0) {
      history = [...history, ...responseItems];
      await append({
        type: "history-items-added",
        payload: toJsonPayload({
          items: responseItems,
        }),
      });
    }

    const toolCalls = responseItems.filter(isFunctionToolCall);
    if (toolCalls.length === 0) {
      await append({
        type: "agent-loop-finished",
        payload: { turns: turn, stopReason: "completed" },
      });
      return;
    }

    const toolOutputs = await executeToolCalls({ append, toolCalls, turn });
    history = [...history, ...toolOutputs];
    await append({
      type: "history-items-added",
      payload: toJsonPayload({
        items: toolOutputs,
      }),
    });
  }

  await append({
    type: "agent-loop-finished",
    payload: { turns: MAX_AGENT_TURNS, stopReason: "max_turns" },
  });
}

async function streamResponseTurn({
  append,
  history,
  turn,
}: {
  append: (event: { type: string; payload: JSONObject }) => Promise<void>;
  history: ResponseInput;
  turn: number;
}): Promise<ResponseInputItem[]> {
  const completedItems: ResponseOutputItem[] = [];

  const stream = await openai.responses.create({
    model: MODEL,
    instructions: SYSTEM_PROMPT,
    input: history,
    tools,
    parallel_tool_calls: true,
    stream: true,
  });

  for await (const streamEvent of stream) {
    await append({ type: "openai-stream-event", payload: toJsonObject(streamEvent) });

    if (streamEvent.type === "response.output_item.done") {
      completedItems.push(streamEvent.item);
    }
  }

  await append({
    type: "agent-turn-completed",
    payload: toJsonPayload({
      turn,
      outputItems: completedItems.length,
      assistantText: getAssistantText(completedItems),
    }),
  });

  return completedItems.map(toHistoryItem).filter((item): item is ResponseInputItem => item != null);
}

async function executeToolCalls({
  append,
  toolCalls,
  turn,
}: {
  append: (event: { type: string; payload: JSONObject }) => Promise<void>;
  toolCalls: ResponseFunctionToolCall[];
  turn: number;
}): Promise<ResponseInputItem[]> {
  return Promise.all(
    toolCalls.map(async (toolCall) => {
      await append({
        type: "tool-call-started",
        payload: {
          turn,
          callId: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
      });

      try {
        const output = await executeToolCall(toolCall);
        await append({
          type: "tool-call-completed",
          payload: {
            turn,
            callId: toolCall.call_id,
            name: toolCall.name,
            outputPreview: output.slice(0, 500),
          },
        });

        return {
          type: "function_call_output" as const,
          call_id: toolCall.call_id,
          output,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await append({
          type: "tool-call-failed",
          payload: {
            turn,
            callId: toolCall.call_id,
            name: toolCall.name,
            message,
          },
        });

        return {
          type: "function_call_output" as const,
          call_id: toolCall.call_id,
          output: JSON.stringify({ error: message }, null, 2),
        };
      }
    }),
  );
}

async function executeToolCall(toolCall: ResponseFunctionToolCall): Promise<string> {
  if (toolCall.name !== "fetch_url") {
    throw new Error(`Unknown tool "${toolCall.name}"`);
  }

  const rawArgs: unknown = JSON.parse(toolCall.arguments);
  const parsedArgs = FetchUrlArgs.safeParse(rawArgs);
  if (!parsedArgs.success) {
    throw new Error(`Invalid fetch_url arguments: ${parsedArgs.error.message}`);
  }

  const { url, method = "GET", headers, body } = parsedArgs.data;
  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const responseBody = method === "HEAD" ? "" : await response.text();
  const truncated = responseBody.length > MAX_FETCH_BODY_CHARS;
  const displayBody = truncated
    ? `${responseBody.slice(0, MAX_FETCH_BODY_CHARS)}\n\n[truncated at ${MAX_FETCH_BODY_CHARS} chars]`
    : responseBody;

  return JSON.stringify(
    {
      url,
      method,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      bodyLength: responseBody.length,
      truncated,
      body: displayBody,
    },
    null,
    2,
  );
}

function isFunctionToolCall(item: ResponseInputItem): item is ResponseFunctionToolCall {
  return item.type === "function_call";
}

function getAssistantText(items: ResponseOutputItem[]) {
  return items
    .map((item) => toAssistantInputMessage(item))
    .filter((message): message is EasyInputMessage => message != null)
    .map((message) => {
      if (typeof message.content === "string") {
        return message.content;
      }
      return message.content
        .filter((part): part is ResponseInputText => part.type === "input_text")
        .map((part) => part.text)
        .join("");
    })
    .join("\n");
}

function toAssistantInputMessage(item: ResponseOutputItemDoneEvent["item"]): EasyInputMessage | null {
  if (item.type !== "message") {
    return null;
  }

  const content = item.content.reduce((text, part) => {
    if (part.type !== "output_text") {
      return text;
    }
    return text + part.text;
  }, "");

  if (!content) {
    return null;
  }

  return {
    type: "message",
    role: "assistant",
    content,
    phase: item.phase ?? null,
  };
}

function toHistoryItem(item: ResponseOutputItem): ResponseInputItem | null {
  if (item.type === "message" || item.type === "function_call") {
    return item;
  }

  return null;
}

function toJsonPayload(value: unknown): JSONObject {
  return toJsonObject(value);
}
