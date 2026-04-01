import { createEventsClient } from "ai-engineer-workshop";

export default async (name: string) => {
  const BASE_URL = process.env.BASE_URL || "https://events.iterate.com";
  const STREAM_PATH = `/${name}/hello-world`;

  const client = createEventsClient(BASE_URL);

  const result = await client.append({
    path: STREAM_PATH,
    events: [
      {
        path: STREAM_PATH,
        type: "hello-world",
        payload: { message: "hiya world" + Date.now() },
      },
    ],
  });

  console.log(JSON.stringify(result, null, 2));
}