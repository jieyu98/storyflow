import { NextResponse } from "next/server";
import { ttsWithTimestamps } from "@/lib/elevenlabs";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: unknown;
      voiceId?: unknown;
      modelId?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
    const modelId =
      typeof body.modelId === "string" && body.modelId
        ? body.modelId
        : "eleven_multilingual_v2";

    if (!text) {
      return NextResponse.json({ error: "Script is empty." }, { status: 400 });
    }
    if (!voiceId) {
      return NextResponse.json(
        { error: "Pick a voice first." },
        { status: 400 },
      );
    }

    const result = await ttsWithTimestamps(text, voiceId, modelId);
    if (!result.alignment) {
      return NextResponse.json(
        {
          error:
            "ElevenLabs returned audio but no timestamps. Try the Multilingual v2 model.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      audioBase64: result.audioBase64,
      alignment: result.alignment,
    });
  } catch (err) {
    return apiError(err);
  }
}
