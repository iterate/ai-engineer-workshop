import { defineProcessor, PullProcessorRuntime } from "ai-engineer-workshop";
import { chat } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import z from "zod";

const AgentInput = z.object({
    content: z.string(),
    role: z.enum(["user", "assistant"])
})

export const AgentInputEvent = z.object({
    type: z.literal("agent-input-added"),
    payload: AgentInput
})

type AgentState = {
    history: z.infer<typeof AgentInput>[]
}   

export const processor = defineProcessor<AgentState>(() => ({
    slug: "agent",
    initialState: { history: [] },
    reduce: ({ event, state }) => {
        const { success, data } = AgentInputEvent.safeParse(event)
        if (success) {
            return { history: [...state.history, data.payload] }            
        }
    },
    afterAppend: async ({ append, event, state, logger }) => {
        const { success, data } = AgentInputEvent.safeParse(event)
        if (!success || data.payload.role !== "user") {
            logger.info("Ignoring event", event)
            return
        }
    
        console.log("Making LLM request for event", data)
    
        const response = await chat({
            adapter: openaiText("gpt-5.2"),
            messages: state.history,
            stream: false
        })
        await append({
            event: {
                type: "agent-input-added",
                payload: {
                    content: response,
                    role: "assistant"
                }
            }
        })
    

    }
}))

if (import.meta.main) {
    await new PullProcessorRuntime({
        path: "/video",
        includeChildren: true,
        processor
    }).run()
}