import {
  createEventsClient,
  type EventInput,
  getDefaultWorkshopPathPrefix,
  normalizePathPrefix,
} from "ai-engineer-workshop";

const baseUrl = process.env.BASE_URL || "https://events.iterate.com";
const pathPrefix = normalizePathPrefix(process.env.PATH_PREFIX || getDefaultWorkshopPathPrefix());
const streamPath = process.env.STREAM_PATH || `${pathPrefix}/00-hello-world`;
const client = createEventsClient(baseUrl);

console.log(`Watching ${streamPath}`);
console.log(`Append {"type":"ping"} to trigger a pong.`);

for await (const event of await client.stream({ path: streamPath, live: true }, {})) {
  if (event.type !== "ping") {
    continue;
  }

  console.log(`ping offset=${event.offset}`);
  await appendEvent(streamPath, { type: "pong", payload: {} });
}

async function appendEvent(path: string, body: EventInput) {
  await client.append({
    params: { path },
    body,
  } as any);
}
