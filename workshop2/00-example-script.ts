import { createEventsClient } from "ai-engineer-workshop";
import { workshopStreamPath } from "./path-prefix.ts";

const streamPath = workshopStreamPath("00-workshop-harness");
const client = createEventsClient();

const result = await client.append({
  path: streamPath,
  event: { type: "hello-world" },
});

console.log(JSON.stringify(result, null, 2));
