# What's the point of this?

I believe we haven't yet seen the final form of agent harnesses. So I want to make it easier to hack on them.

This workshop and repo is a playground for trying out some (possibly dumb) ideas:

1. Agent harnesses can (should?) be implemented using nothing but `append()` and `stream()` operations on an immutable append only durable stream
2. Harness plugins can (should?) be implemented using nothing but `append()` and `stream()` operations on an immutable append only durable stream
3. All agents should have a URL that I can post to
4. The agent harness itself can (should?) be a distributed system of small networked programs
5. All state in the system should be event sourced / derived from the immutable append only durable stream

Agents written in this way have a lot of benefits:
- Easy to debug (everything is an event)
- Hacking on the harness core is no different from hacking on a plugin/extension (everything is just a stream reducer)
- Stteam reducers compose very nicely and naturally
- You can just post webhooks from third parties directly to them
- Different agent harnesses can interoperate (provided they share a few event schemas)

But this is also a terrible idea because:
- Infinite loops - you can easily get two stream processors pooping events back and forth forever
- Need to think hard about authz
- You get A LOT of events very quickly

Though my feeling is that you have to deal with these downsides in more hidden forms in any agent harness, so maybe it's best to tackle head-on.

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

Then use `

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

