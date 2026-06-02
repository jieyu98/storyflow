import { NextResponse } from "next/server";
import { ElevenLabsError } from "./elevenlabs";

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

  const message =
    err instanceof Error ? err.message : "Unexpected server error.";
  console.error("[storyflow] api error:", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
