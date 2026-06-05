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

/* ------------------------------ batch API -------------------------------- */
// xAI Batch API: submit many video jobs at once (cheaper, async up to ~24h).
//   POST /v1/batches                       -> { batch_id }
//   POST /v1/batches/{id}/requests         (add inline requests)
//   GET  /v1/batches/{id}                  -> { state, expires_at }
//   GET  /v1/batches/{id}/results          -> { results, pagination_token }
//   POST /v1/batches/{id}:cancel
// Each video request mirrors the sync /v1/videos/generations body, so
// image-to-video works via the same `image: { url }` (base64 data URI) field.

const authHeader = () => ({
  Authorization: `Bearer ${serverEnv.XAI_API_KEY}`,
});

export type BatchState = {
  num_requests: number;
  num_pending: number;
  num_success: number;
  num_error: number;
  num_cancelled?: number;
};

export async function createBatch(name: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/batches`, {
    method: "POST",
    headers: { ...authHeader(), "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new GrokError(res.status, await readError(res));
  const data = (await res.json()) as { batch_id?: string };
  if (!data.batch_id) throw new GrokError(502, "Grok returned no batch id.");
  return data.batch_id;
}

export type VideoBatchRequest = {
  batchRequestId: string;
  prompt: string;
  /** base64 data URI of the starting frame (image-to-video). */
  image?: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
};

export async function addVideoBatchRequests(
  batchId: string,
  reqs: VideoBatchRequest[],
): Promise<void> {
  const batch_requests = reqs.map((r) => ({
    batch_request_id: r.batchRequestId,
    batch_request: {
      video_generation: {
        model: GROK_VIDEO_MODEL,
        prompt: r.prompt,
        ...(r.image ? { image: { url: r.image } } : {}),
        ...(r.duration ? { duration: r.duration } : {}),
        aspect_ratio: r.aspectRatio ?? "9:16",
        resolution: r.resolution ?? "720p",
      },
    },
  }));
  const res = await fetch(`${BASE}/v1/batches/${batchId}/requests`, {
    method: "POST",
    headers: { ...authHeader(), "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ batch_requests }),
  });
  if (!res.ok) throw new GrokError(res.status, await readError(res));
}

export async function getBatch(
  batchId: string,
): Promise<{ state: BatchState; expiresAt?: number }> {
  const res = await fetch(`${BASE}/v1/batches/${batchId}`, {
    headers: authHeader(),
    cache: "no-store",
  });
  if (!res.ok) throw new GrokError(res.status, await readError(res));
  const data = (await res.json()) as {
    state?: Partial<BatchState>;
    expires_at?: string | number;
  };
  const state: BatchState = {
    num_requests: data.state?.num_requests ?? 0,
    num_pending: data.state?.num_pending ?? 0,
    num_success: data.state?.num_success ?? 0,
    num_error: data.state?.num_error ?? 0,
    num_cancelled: data.state?.num_cancelled,
  };
  const expiresAt =
    data.expires_at != null ? new Date(data.expires_at).getTime() : undefined;
  return { state, expiresAt: Number.isNaN(expiresAt) ? undefined : expiresAt };
}

export type BatchVideoResult = {
  batchRequestId: string;
  videoUrl?: string;
  costTicks?: number;
  errorMessage?: string;
};

/** One page of results. Loop on `paginationToken` until it's undefined. */
export async function getBatchResults(
  batchId: string,
  paginationToken?: string,
): Promise<{ results: BatchVideoResult[]; paginationToken?: string }> {
  const url = new URL(`${BASE}/v1/batches/${batchId}/results`);
  url.searchParams.set("limit", "100");
  if (paginationToken) url.searchParams.set("pagination_token", paginationToken);
  const res = await fetch(url, { headers: authHeader(), cache: "no-store" });
  if (!res.ok) throw new GrokError(res.status, await readError(res));
  const data = (await res.json()) as {
    results?: {
      batch_request_id?: string;
      error_message?: string;
      batch_result?: {
        error_message?: string;
        response?: {
          video_generation?: {
            video?: { url?: string };
            usage?: { cost_in_usd_ticks?: number };
          };
        };
      };
    }[];
    pagination_token?: string | null;
  };
  const results = (data.results ?? []).map((r) => {
    const vg = r.batch_result?.response?.video_generation;
    return {
      batchRequestId: r.batch_request_id ?? "",
      videoUrl: vg?.video?.url,
      costTicks: vg?.usage?.cost_in_usd_ticks,
      errorMessage: r.error_message ?? r.batch_result?.error_message,
    };
  });
  return { results, paginationToken: data.pagination_token ?? undefined };
}

export async function cancelBatch(batchId: string): Promise<void> {
  const res = await fetch(`${BASE}/v1/batches/${batchId}:cancel`, {
    method: "POST",
    headers: authHeader(),
    cache: "no-store",
  });
  if (!res.ok) throw new GrokError(res.status, await readError(res));
}
