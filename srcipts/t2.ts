import { createEventsClient } from "ai-engineer-workshop";

export default async (name: string) => {
  const BASE_URL = process.env.BASE_URL || "https://events.iterate.com";
  const STREAM_PATH = `/${name}/hello-world`;

  const client = createEventsClient(BASE_URL);

  const events = await client.stream({
    path: "/misha/hello-world",
    offset: "0000000000000004",
    live: true,
  })

  console.log("misha events");
  for await (const event of events) {
    console.log(event);
    if ((event.payload as any).message.endsWith("7")) {
    await client.append({
        path: "/misha/hello-world",
        events: [
          {
            path: "/misha/hello-world",
            type: "hello-world",
            payload: { message: "i saw a seven!" },
          },
        ],
      })
    }
  }
}