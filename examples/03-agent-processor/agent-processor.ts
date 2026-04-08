import { defineProcessor } from "ai-engineer-workshop";
import OpenAI from "openai";

type AgentState = { count: number };
const initialState: AgentState = { count: 0 };

export default defineProcessor(() => ({
  slug: "agent",
  initialState,

  reduce: ({ event, state }) => {
    if (event.type !== "agent-input-added") return state;
    return { count: state.count + 1 };
  },

  afterAppend: async ({ append, event }) => {
    if (event.type !== "agent-input-added") return;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: getAgentInputText(event.payload),
    });

    await append({
      event: {
        type: "agent-output-added",
        payload: {
          content: response.output_text,
          responseId: response.id,
          sourceOffset: event.offset,
        },
      },
    });
  },
}));

function getAgentInputText(payload: unknown) {
  const content =
    typeof payload === "object" && payload != null && "content" in payload
      ? payload.content
      : undefined;
  if (typeof content === "string" && content.length > 0) {
    return content;
  }

  return JSON.stringify(payload);
}
