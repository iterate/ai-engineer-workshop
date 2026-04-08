import { createEventsClient } from "ai-engineer-workshop";
import { workshopStreamPath } from "./path-prefix.ts";

async function main() {
  const streamPath = workshopStreamPath("00-hello-world");
  const client = createEventsClient();

  for await (const event of await client.stream({ path: streamPath, live: true }, {})) {
    if (event.type === "ping") {
      await client.append({
        path: streamPath,
        event: { type: "pong" },
      });
    }
  }
}

main().catch((error: unknown) => {
  console.log(error);
  process.exitCode = 1;
});
