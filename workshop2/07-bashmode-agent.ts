import {
  createEventsClient,
  PullSubscriptionProcessorRuntime,
  workshopLogger,
} from "ai-engineer-workshop";
import { agentProcessor } from "./agent-processor.ts";
import bashmode from "./bashmode.ts";
import { workshopStreamPath } from "./path-prefix.ts";

async function main() {
  const streamPath = workshopStreamPath("bashmode-agent");
  const eventsClient = createEventsClient();

  console.log(`Watching ${streamPath}`);

  await Promise.all([
    new PullSubscriptionProcessorRuntime({
      eventsClient,
      logger: workshopLogger,
      processor: agentProcessor,
      streamPath,
    }).run(),
    new PullSubscriptionProcessorRuntime({
      eventsClient,
      logger: workshopLogger,
      processor: bashmode,
      streamPath,
    }).run(),
  ]);
}

main().catch((error: unknown) => {
  console.log(error);
  process.exitCode = 1;
});
