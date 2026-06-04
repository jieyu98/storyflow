// Grok image-to-video generation ("Grok Imagine"). The one place the app makes
// VIDEO — gated behind XAI_API_KEY and an explicit user action.
//
// The xAI video API is ASYNCHRONOUS:
//   POST /v1/videos/generations            -> { request_id }
//   GET  /v1/videos/{request_id}  (poll)   -> { status, video?: { url } }
// status walks pending -> done | failed | expired. On "done", video.url is a
// temporary hosted mp4. generateVideoAndWait submits, polls to completion, and
// returns that url; the caller downloads it and stores it as the scene's clip.

import { serverEnv, GROK_VIDEO_MODEL } from "@/server/env";

const BASE = "https://api.x.ai";

export class GrokError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GrokError";
    this.status = status;
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message ?? data?.error ?? data?.message ?? JSON.stringify(data);
  } catch {
    return res.statusText;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Submit an image-to-video job and poll until it finishes. `image` is a base64
 * data URI (data:image/png;base64,…) — xAI's servers can't reach a localhost
 * URL, so the starting frame is inlined. Returns the temporary mp4 URL.
 */
export async function generateVideoAndWait(
  {
    prompt,
    image,
    duration,
    aspectRatio = "9:16",
    resolution = "720p",
  }: {
    prompt: string;
    image?: string;
    duration?: number;
    aspectRatio?: string;
    resolution?: string;
  },
  { timeoutMs = 240_000, pollMs = 3_000 }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<string> {
  const auth = { Authorization: `Bearer ${serverEnv.XAI_API_KEY}` };

  const submit = await fetch(`${BASE}/v1/videos/generations`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      model: GROK_VIDEO_MODEL,
      prompt,
      ...(image ? { image: { url: image } } : {}),
      ...(duration ? { duration } : {}),
      aspect_ratio: aspectRatio,
      resolution,
    }),
  });
  if (!submit.ok) throw new GrokError(submit.status, await readError(submit));

  const { request_id: requestId } = (await submit.json()) as {
    request_id?: string;
  };
  if (!requestId) throw new GrokError(502, "Grok returned no request id.");

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(pollMs);
    const res = await fetch(`${BASE}/v1/videos/${requestId}`, {
      headers: auth,
      cache: "no-store",
    });
    if (!res.ok) throw new GrokError(res.status, await readError(res));
    const data = (await res.json()) as {
      status?: string;
      video?: { url?: string };
    };
    if (data.status === "done") {
      if (!data.video?.url) throw new GrokError(502, "Grok finished without a video url.");
      return data.video.url;
    }
    if (data.status === "failed" || data.status === "expired") {
      throw new GrokError(502, `Grok video ${data.status}.`);
    }
  }
  throw new GrokError(504, "Timed out waiting for the video.");
}
