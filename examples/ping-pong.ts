import { defineProcessor } from "ai-engineer-workshop";

/**
 * Appends a `pong` to any event that includes "ping"
 */
export const processor = defineProcessor(() => ({
  slug: "ping-pong",
  afterAppend: async ({ append, event }) => {
    if(!JSON.stringify(event.payload).includes("ping")) return;
    await append({ event: { type: "pong", payload: { sourceOffset: event.offset } } });
  },
}));
