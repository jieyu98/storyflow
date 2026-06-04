import { NextResponse } from "next/server";
import { generateSceneBeats } from "@/lib/anthropic";
import { buildScenesFromBeats } from "@/lib/scenes";
import { getSceneSystem } from "@/lib/scriptStyles";
import { apiError } from "@/lib/http";
import { MAX_CLIP_SECONDS, type VisualBible, type Word } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const EMPTY_BIBLE: VisualBible = { characters: [], locations: [] };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      words?: Word[];
      visualBible?: VisualBible;
      title?: string;
      coreTurn?: string;
      scriptStyleId?: string;
    };
    const words = Array.isArray(body.words) ? body.words : [];
    if (words.length === 0) {
      return NextResponse.json(
        { error: "Generate a voiceover first — there are no timestamps to cut." },
        { status: 400 },
      );
    }
    const beats = await generateSceneBeats(
      words,
      body.visualBible ?? EMPTY_BIBLE,
      MAX_CLIP_SECONDS,
      {
        title: body.title,
        coreTurn: body.coreTurn,
        system: getSceneSystem(body.scriptStyleId),
      },
    );
    if (beats.length === 0) {
      return NextResponse.json(
        { error: "The model returned no scenes. Try regenerating." },
        { status: 502 },
      );
    }
    const scenes = buildScenesFromBeats(words, beats, MAX_CLIP_SECONDS);
    return NextResponse.json({ scenes });
  } catch (err) {
    return apiError(err);
  }
}
