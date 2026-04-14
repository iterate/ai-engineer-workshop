import { createEventsClient } from "ai-engineer-workshop";

const client = createEventsClient()

const result = await client.append({
    path: "/video/hello-world",
    event: {
        type: "agent-input-added",
        payload: {
            content: "Tell a joke",
            role: "user"
        }
    }
})

console.log(result)