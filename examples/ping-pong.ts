import { defineProcessor } from "ai-engineer-workshop";

/**
 * Appends a `pong` to any event that includes "ping"
 * 
 * Deploy using: 
 * pnpm ai-engineer-workshop deploy --stream-path /your-stream-path --file ./examples/ping-pong.ts
 * 
 */
export const processor = defineProcessor(() => ({
  slug: "ping-pong",
  afterAppend: async ({ append, event }) => {
    if(!JSON.stringify(event.payload).includes("ping")) return;
    await append({ event: { type: "pong", payload: { sourceOffset: event.offset } } });
  },
}));
