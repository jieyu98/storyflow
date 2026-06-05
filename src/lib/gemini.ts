// Gemini image generation ("Nano Banana"). Used for in-app stills: bible
// reference images and per-scene starting frames. This is the one place the app
// generates media — gated behind GEMINI_API_KEY and an explicit user action.
//
// REST: POST {BASE}/v1beta/models/{model}:generateContent with x-goog-api-key.
// Request parts carry the text prompt plus any reference images (inlineData,
// base64). The model returns both a text part and an image part; we pull the
// image bytes out of candidates[0].content.parts[].inlineData.

import { serverEnv, GEMINI_IMAGE_MODEL } from "@/server/env";

const BASE = "https://generativelanguage.googleapis.com";

export class GeminiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

/** An input/output image as raw base64 + mime (no data: prefix). */
export type InlineImage = { base64: string; mime: string };

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message ?? JSON.stringify(data);
  } catch {
    return res.statusText;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pull the image bytes out of a generateContent response (or throw). */
function parseImage(data: {
  candidates?: {
    content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
  }[];
  promptFeedback?: { blockReason?: string };
}): InlineImage {
  if (data.promptFeedback?.blockReason) {
    throw new GeminiError(
      400,
      `Image blocked by Gemini safety filter (${data.promptFeedback.blockReason}).`,
    );
  }
  const imgPart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data,
  );
  const inline = imgPart?.inlineData;
  if (!inline?.data) {
    throw new GeminiError(502, "Gemini returned no image.");
  }
  return { base64: inline.data, mime: inline.mimeType ?? "image/png" };
}

/**
 * Generate one image. `inputImages` are passed as references for consistency
 * (e.g. a character/location reference reused across scenes). `aspectRatio`
 * like "9:16" (vertical), "1:1", "16:9".
 *
 * `flex` uses the Gemini Flex service tier: ~50% cheaper, but slower (minutes)
 * and best-effort/sheddable — so on Flex we retry 503/429 with backoff and allow
 * a long timeout. Standard requests stay single-shot with a short timeout.
 */
export async function generateImage({
  prompt,
  inputImages = [],
  aspectRatio = "9:16",
  flex = false,
  model,
}: {
  prompt: string;
  inputImages?: InlineImage[];
  aspectRatio?: string;
  flex?: boolean;
  /** Gemini image model id; defaults to GEMINI_IMAGE_MODEL. */
  model?: string;
}): Promise<InlineImage> {
  const imageModel = model ?? GEMINI_IMAGE_MODEL;
  const parts: Part[] = [{ text: prompt }];
  for (const img of inputImages) {
    parts.push({ inlineData: { mimeType: img.mime, data: img.base64 } });
  }

  const body: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio },
    },
  };
  if (flex) body.service_tier = "flex";

  const timeoutMs = flex ? 600_000 : 120_000;

  async function attemptOnce(): Promise<InlineImage> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(
        `${BASE}/v1beta/models/${imageModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": serverEnv.GEMINI_API_KEY,
          },
          cache: "no-store",
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (!res.ok) throw new GeminiError(res.status, await readError(res));
      return parseImage(await res.json());
    } finally {
      clearTimeout(timer);
    }
  }

  const maxAttempts = flex ? 3 : 1;
  let lastError: GeminiError | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await attemptOnce();
    } catch (e) {
      const err =
        e instanceof GeminiError
          ? e
          : new GeminiError(504, e instanceof Error ? e.message : "Request failed.");
      // Only Flex congestion (or a timeout/abort) is worth retrying; a block,
      // bad prompt, or "no image" is terminal.
      const retryable =
        flex && (err.status === 503 || err.status === 429 || err.status === 504);
      if (!retryable || attempt === maxAttempts - 1) throw err;
      lastError = err;
      await sleep(3000 * (attempt + 1)); // 3s, 6s
    }
  }
  throw lastError ?? new GeminiError(502, "Flex image generation failed.");
}
