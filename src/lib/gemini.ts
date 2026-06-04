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

/**
 * Generate one image. `inputImages` are passed as references for consistency
 * (e.g. a character/location reference reused across scenes). `aspectRatio`
 * like "9:16" (vertical), "1:1", "16:9".
 */
export async function generateImage({
  prompt,
  inputImages = [],
  aspectRatio = "9:16",
}: {
  prompt: string;
  inputImages?: InlineImage[];
  aspectRatio?: string;
}): Promise<InlineImage> {
  const parts: Part[] = [{ text: prompt }];
  for (const img of inputImages) {
    parts.push({ inlineData: { mimeType: img.mime, data: img.base64 } });
  }

  const res = await fetch(
    `${BASE}/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": serverEnv.GEMINI_API_KEY,
      },
      cache: "no-store",
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio },
        },
      }),
    },
  );

  if (!res.ok) {
    throw new GeminiError(res.status, await readError(res));
  }

  const data = (await res.json()) as {
    candidates?: {
      content?: {
        parts?: { inlineData?: { mimeType?: string; data?: string } }[];
      };
    }[];
    promptFeedback?: { blockReason?: string };
  };

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
