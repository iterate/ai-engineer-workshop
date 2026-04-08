import { createEventsClient, defineProcessor, PullSubscriptionProcessorRuntime } from "ai-engineer-workshop";

type HelloWorldState = { count: number };
const initialState: HelloWorldState = { count: 0 };

const processor = defineProcessor(() => ({
slug: "hello-world",
initialState,

  reduce: ({ event, state }) => {
    if (event.type !== "hello-world") return state;
    return { count: state.count + 1 };
  },

  afterAppend: async ({ append, event, state }) => {
    if (event.type !== "hello-world" || state.count !== 1) return;

    await append({
      path: "/jonas/example",
      event: {
        type: "hello-world-seen",
        payload: { sourceOffset: event.offset },
      },
    });
  },
}));

await new PullSubscriptionProcessorRuntime({
  eventsClient: createEventsClient(),
  processor,
  streamPath: "/jonas/example",
}).run();



