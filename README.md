# What's the point of this?

I believe we haven't yet seen the final form of agent harnesses. So I want to make it easier to hack on them.

This workshop and repo is a playground for trying out some (possibly dumb) ideas:

1. Agent harnesses should be implemented using nothing but these operations on an append only log of events:
  -  `append({ path, event })` to add an event
  -  `stream({ path, beforeOffset?, afterOffset? })` to read/consume stream
2. Harness "plugins" should be the same thing
3. Harness and plugins can run on different machines
4. All agents should have a URL that I can post to
5. All state in the system should be event-sourced

To prove this, we'll write an "agent harness" from scratch!

# How to play with this 

We've deployed a very simple durable streams server at https://events.iterate.com with `append()` and `stream()` operations. The API is inspired by [durable-streams](https://github.com/durable-streams/durable-streams) but not 100% the same.

Streams are organised into a hierarchy of stream paths, starting with `/` . So `/jonas` and `/jonas/hi` etc are all stream paths

Events in a stream have this shape 

```ts
type Event = {
  type: string;
  payload?: Record<string, any>;

  idempotencyKey?: string;
  metadata?: Record<string, any>;

  // Server assigned
  streamPath: string;
  offset: number;
  createdAt: string;
}
```

The only supported operations are:

1. `append({ path, event })` - append an event to a stream
2. `stream({ path, beforeOffset?, afterOffset? })` - stream events from stream

There's a UI at https://events.iterate.com that you can use 

WARNING: Streams on events.iterate.com are currently entirely public and regularly deleted!

Here's how you can use it

```bash
export PATH_PREFIX="/$(id -un)"
export BASE_URL="https://events.iterate.com"
export STREAM_PATH="${PATH_PREFIX}/hello-world"
curl -sN "${BASE_URL}/api/streams${STREAM_PATH}?beforeOffset=end"

# Let's create our first event
curl --json '{"type": "hello-world"}' \
  "${BASE_URL}/api/streams${STREAM_PATH}"

# Let's see if it's there
curl -N "${BASE_URL}/api/streams${STREAM_PATH}"

# We can also live tail the stream
# With pretty printing
curl -sN "${BASE_URL}/api/streams${STREAM_PATH}?beforeOffset=end"

```

### Typescript SDK

Use `createEventsClient` to interact with events.iterate.com. The principal operations are `append` and `stream`.

```ts
import { createEventsClient } from "ai-engineer-workshop";

const client = createEventsClient();

await client.append({
  path: streamPath,
  event: {
    type: "hello-world",
    payload: { message: "hello world" },
  },
});

const stream = await client.stream({
  path: streamPath
});

for await (const event of stream) {
  console.log(event);
}

```

Use the slightly higher level `defineProcessor` to create a stream processor with well defined 

- `state` shape
- `reduce` function
- `afterAppend` function for side effects

Then use `PullProcessorRuntime` to run the processor locally.

```ts
import { defineProcessor, PullProcessorRuntime } from "ai-engineer-workshop";

export const processor = defineProcessor(() => ({
  slug: "hello-world",
  initialState: { seen: 0 },
  reduce: ({ event, state }) => (event.type === "hello-world" ? { seen: state.seen + 1 } : state),
  afterAppend: async ({ append, event, state }) => {
    if (event.type !== "hello-world" || state.seen !== 1) return;
    await append({
      event: { type: "hello-world-seen", payload: { sourceOffset: event.offset } },
    });
  },
}));

if (import.meta.main) {
  await new PullProcessorRuntime({
    path: "/path-prefix",
    // Attach processor to all paths under /path-prefix
    includeChildren: true,
    processor,
  }).run();
}
```

# Deploy a processor by appending it to a stream

This is highly experimental, but gives you a glimpse of where this might go:

```bash
pnpm ai-engineer-workshop deploy --stream-path /your/stream --file ./your-processor.ts
```

You just need to make sure you export the processor from the file you pass to `--file`.

This bundles the processor and all dependencies into an event and appends it to the stream. `events.iterate.com` then runs that processor for you. 

# Processors you can easily build now

It's all just processors!

- Add events for model and system prompt setting
- Debounce inputs so repeated inputs don't interrupt the LLM over and over
- Collect prompt context from "context providers" (e.g. RAG from knowledge bases) for some period of time before making each LLM request
- Image / attachment event types
- Opencode / pi bridge - we could have a processor that sits between an opencode agent and e.g. a pi or opencode session - so we could speak to all these agent harnesses using a single input interface
- Different compaction strategies
- Multi LLM agent (via tanstack AI or vercel AI sdk for example)
- Allow agents to have multple multiple LLM requests in flight at the same time
  - ... for safety - run a prompt injection protector in parallel
  - ... or to allow "sidebar" conversations
- Proper codemode - add new tools via events!
