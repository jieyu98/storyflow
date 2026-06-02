import { serverEnv } from "@/server/env";
import type { AlignmentArrays, VoiceOption } from "./types";

const BASE = "https://api.elevenlabs.io";

export class ElevenLabsError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ElevenLabsError";
    this.status = status;
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return (
      data?.detail?.message ??
      data?.detail ??
      data?.message ??
      JSON.stringify(data)
    );
  } catch {
    return res.statusText;
  }
}

export async function listVoices(): Promise<VoiceOption[]> {
  const res = await fetch(`${BASE}/v2/voices?page_size=100`, {
    headers: { "xi-api-key": serverEnv.ELEVENLABS_API_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ElevenLabsError(res.status, await readError(res));
  }
  const data = (await res.json()) as { voices?: VoiceOption[] };
  return (data.voices ?? []).map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    preview_url: v.preview_url,
    labels: v.labels,
  }));
}

export type TtsResult = {
  audioBase64: string;
  alignment: AlignmentArrays | null;
};

export async function ttsWithTimestamps(
  text: string,
  voiceId: string,
  modelId: string,
): Promise<TtsResult> {
  const res = await fetch(
    `${BASE}/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": serverEnv.ELEVENLABS_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ text, model_id: modelId }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new ElevenLabsError(res.status, await readError(res));
  }
  const data = (await res.json()) as {
    audio_base64: string;
    alignment: AlignmentArrays | null;
  };
  return { audioBase64: data.audio_base64, alignment: data.alignment ?? null };
}
