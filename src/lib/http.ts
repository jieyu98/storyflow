import { NextResponse } from "next/server";
import { ElevenLabsError } from "./elevenlabs";
import { GeminiError } from "./gemini";

/** Map server/library errors to a friendly JSON response. */
export function apiError(err: unknown): NextResponse {
  if (err instanceof ElevenLabsError) {
    const msg =
      err.status === 401
        ? "ElevenLabs rejected the API key — check ELEVENLABS_API_KEY."
        : err.status === 429
          ? "ElevenLabs is busy (concurrency/rate limit). Wait a moment and retry."
          : `ElevenLabs error: ${err.message}`;
    return NextResponse.json({ error: msg }, { status: err.status });
  }

  if (err instanceof GeminiError) {
    const msg =
      err.status === 401 || err.status === 403
        ? `Gemini rejected the request (check GEMINI_API_KEY / model access): ${err.message}`
        : err.status === 429
          ? `Gemini quota or rate limit hit — premium models like gemini-3-pro-image often have no free-tier quota. Detail: ${err.message}`
          : `Gemini error: ${err.message}`;
    return NextResponse.json({ error: msg }, { status: err.status });
  }

  const message =
    err instanceof Error ? err.message : "Unexpected server error.";
  console.error("[storyflow] api error:", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
