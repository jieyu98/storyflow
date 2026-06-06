// Gemini Batch API for Nano Banana image generation: 50% cheaper than the
// interactive API and with higher rate limits, in exchange for async turnaround
// (target 24h, usually much faster). Flow per docs/gemini/batch-api.md:
//   1. Upload a JSONL file (one keyed GenerateContentRequest per line) via the
//      resumable File API → a `files/…` name.
//   2. POST models/{model}:batchGenerateContent with input_config.file_name →
//      a `batches/…` job name.
//   3. Poll GET /v1beta/{batch} until a terminal JOB_STATE_*.
//   4. Download the results JSONL (download/v1beta/{file}:download?alt=media);
//      each line carries our `key` plus a GenerateContentResponse or an error.
//
// Only the server (the submit route + the background poller) calls this; gated
// behind GEMINI_API_KEY. Image bytes come back inline (base64) in the results
// file, so — unlike Grok — there are no per-item signed URLs to race against.

import { serverEnv } from "@/server/env";
import { GeminiError, type InlineImage } from "./gemini";

const BASE = "https://generativelanguage.googleapis.com";

function apiKey(): string {
  return serverEnv.GEMINI_API_KEY;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message ?? JSON.stringify(data);
  } catch {
    return res.statusText;
  }
}

export type BatchImageRequest = {
  /** Round-trips to the result line; must be unique within the batch. */
  key: string;
  prompt: string;
  /** Reference images inlined for cross-shot consistency. */
  inputImages?: InlineImage[];
  aspectRatio?: string;
};

/** One line of the input JSONL: our `key` + a GenerateContentRequest. */
function jsonlLine(r: BatchImageRequest): string {
  const parts: unknown[] = [{ text: r.prompt }];
  for (const img of r.inputImages ?? []) {
    parts.push({ inlineData: { mimeType: img.mime, data: img.base64 } });
  }
  return JSON.stringify({
    key: r.key,
    request: {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: r.aspectRatio ?? "9:16" },
      },
    },
  });
}

/** Upload the JSONL input via the resumable File API → its `files/…` name. */
async function uploadJsonl(body: string, displayName: string): Promise<string> {
  const bytes = Buffer.from(body, "utf-8");

  // 1. Start a resumable upload; the upload URL comes back in a response header.
  const start = await fetch(`${BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey(),
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length),
      "X-Goog-Upload-Header-Content-Type": "application/jsonl",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) throw new GeminiError(start.status, await readError(start));
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new GeminiError(502, "Gemini batch upload: no upload URL returned.");
  }

  // 2. Send the bytes and finalize in one shot.
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    cache: "no-store",
    body: bytes,
  });
  if (!up.ok) throw new GeminiError(up.status, await readError(up));
  const info = (await up.json()) as { file?: { name?: string } };
  const name = info.file?.name;
  if (!name) {
    throw new GeminiError(502, "Gemini batch upload: no file name returned.");
  }
  return name;
}

/** Submit a batch image job; returns the `batches/…` job name + input file. */
export async function createImageBatch(
  requests: BatchImageRequest[],
  model: string,
  displayName: string,
): Promise<{ batchId: string; inputFile: string }> {
  const jsonl = requests.map(jsonlLine).join("\n");
  const inputFile = await uploadJsonl(jsonl, `${displayName}-input`);
  const res = await fetch(
    `${BASE}/v1beta/models/${model}:batchGenerateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey(),
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        batch: {
          display_name: displayName,
          input_config: { file_name: inputFile },
        },
      }),
    },
  );
  if (!res.ok) throw new GeminiError(res.status, await readError(res));
  const data = (await res.json()) as { name?: string };
  if (!data.name) {
    throw new GeminiError(502, "Gemini batch: no job name returned.");
  }
  return { batchId: data.name, inputFile };
}

// The live batch endpoint reports state as BATCH_STATE_* (the docs' JOB_STATE_*
// is stale); normalize to the bare phase so we accept either prefix.
const TERMINAL_PHASES = new Set(["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"]);

function statePhase(state: string): string {
  return state.replace(/^(?:JOB|BATCH)_STATE_/, "");
}

export type BatchStatus = {
  /** Raw state for display, e.g. "BATCH_STATE_SUCCEEDED". */
  state: string;
  /** Normalized phase, e.g. "SUCCEEDED" | "RUNNING" | "FAILED". */
  phase: string;
  done: boolean;
  /** Result file name (`files/…`) once the job has succeeded. */
  resultFile?: string;
  error?: string;
};

/** Poll a batch job's status. The state + result file live under `metadata`/
 *  `response`; we read every documented spelling defensively. */
export async function getImageBatchStatus(
  batchId: string,
): Promise<BatchStatus> {
  const res = await fetch(`${BASE}/v1beta/${batchId}`, {
    headers: { "x-goog-api-key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw new GeminiError(res.status, await readError(res));
  const data = (await res.json()) as {
    done?: boolean;
    state?: string;
    metadata?: { state?: string; output?: { responsesFile?: string } };
    error?: { message?: string };
    response?: { responsesFile?: string };
    dest?: { fileName?: string };
  };
  const state = data.metadata?.state ?? data.state ?? "BATCH_STATE_PENDING";
  const phase = statePhase(state);
  return {
    state,
    phase,
    done: data.done === true || TERMINAL_PHASES.has(phase),
    resultFile:
      data.response?.responsesFile ??
      data.metadata?.output?.responsesFile ??
      data.dest?.fileName,
    error: data.error?.message,
  };
}

export type BatchResultLine = {
  key?: string;
  image?: InlineImage;
  error?: string;
};

/** Download + parse the results JSONL into one entry per request line. */
export async function getImageBatchResults(
  resultFile: string,
): Promise<BatchResultLine[]> {
  const res = await fetch(
    `${BASE}/download/v1beta/${resultFile}:download?alt=media`,
    { headers: { "x-goog-api-key": apiKey() }, cache: "no-store" },
  );
  if (!res.ok) throw new GeminiError(res.status, await readError(res));
  const text = await res.text();
  const out: BatchResultLine[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as {
        key?: string;
        response?: {
          candidates?: {
            content?: {
              parts?: { inlineData?: { mimeType?: string; data?: string } }[];
            };
          }[];
          promptFeedback?: { blockReason?: string };
        };
        error?: { message?: string } | string;
        status?: { message?: string };
      };
      const key = parsed.key;
      if (parsed.response) {
        const part = parsed.response.candidates?.[0]?.content?.parts?.find(
          (p) => p.inlineData?.data,
        );
        const inline = part?.inlineData;
        if (inline?.data) {
          out.push({
            key,
            image: { base64: inline.data, mime: inline.mimeType ?? "image/png" },
          });
        } else {
          const block = parsed.response.promptFeedback?.blockReason;
          out.push({
            key,
            error: block ? `Blocked by safety filter (${block}).` : "No image returned.",
          });
        }
      } else {
        const msg =
          typeof parsed.error === "string"
            ? parsed.error
            : parsed.error?.message ?? parsed.status?.message ?? "Request failed.";
        out.push({ key, error: msg });
      }
    } catch {
      // Skip an unparseable line; the request stays pending → marked failed.
    }
  }
  return out;
}

/** Cancel a running batch (best-effort). */
export async function cancelImageBatch(batchId: string): Promise<void> {
  const res = await fetch(`${BASE}/v1beta/${batchId}:cancel`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw new GeminiError(res.status, await readError(res));
}
