import {
  createEventsClient,
  PullSubscriptionPatternProcessorRuntime,
  workshopLogger,
} from "ai-engineer-workshop";
import { agentProcessor } from "./agent-processor.ts";
import { workshopStreamPattern } from "./path-prefix.ts";

/** Appended to `PATH_PREFIX` to build the stream pattern. Default `"/**"`. */
const streamPatternSuffix = process.env.STREAM_PATTERN_SUFFIX ?? "/**";

try {
  const streamPattern = workshopStreamPattern(streamPatternSuffix);

  console.log(`Watching streams matching ${streamPattern}`);

  await new PullSubscriptionPatternProcessorRuntime({
    eventsClient: createEventsClient(),
    logger: workshopLogger,
    processor: agentProcessor,
    streamPattern,
  }).run();
} catch (error: unknown) {
  console.log(error);
  process.exitCode = 1;
}
