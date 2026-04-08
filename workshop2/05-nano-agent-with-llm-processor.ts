import {
  createEventsClient,
  PullSubscriptionProcessorRuntime,
  workshopLogger,
} from "ai-engineer-workshop";
import { agentProcessor } from "./agent-processor.ts";
import { workshopStreamPath } from "./path-prefix.ts";

try {
  const streamPath = workshopStreamPath("nano-agent");

  console.log(`Watching ${streamPath}`);

  await new PullSubscriptionProcessorRuntime({
    eventsClient: createEventsClient(),
    logger: workshopLogger,
    processor: agentProcessor,
    streamPath,
  }).run();
} catch (error: unknown) {
  console.log(error);
  process.exitCode = 1;
}
