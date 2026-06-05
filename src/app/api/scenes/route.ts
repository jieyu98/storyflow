import { NextResponse } from "next/server";
import { generateSceneBeats } from "@/lib/anthropic";
import { buildScenesFromBeats } from "@/lib/scenes";
import { getSceneSystem } from "@/lib/scriptStyles";
import { apiError } from "@/lib/http";
import { recordAnthropicUsage } from "@/server/usage";
import {
  MAX_CLIP_SECONDS,
  SCENE_MODELS,
  type SceneModelId,
  type VisualBible,
  type Word,
} from "@/lib/types";

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
      sceneModelId?: string;
      projectId?: string;
    };
    const words = Array.isArray(body.words) ? body.words : [];
    if (words.length === 0) {
      return NextResponse.json(
        { error: "Generate a voiceover first — there are no timestamps to cut." },
        { status: 400 },
      );
    }
    // Only honor a model from the known allowlist; otherwise fall back to the
    // server default inside generateSceneBeats.
    const model = SCENE_MODELS.some((m) => m.id === body.sceneModelId)
      ? (body.sceneModelId as SceneModelId)
      : undefined;
    const {
      beats,
      usage,
      model: usedModel,
    } = await generateSceneBeats(
      words,
      body.visualBible ?? EMPTY_BIBLE,
      MAX_CLIP_SECONDS,
      {
        title: body.title,
        coreTurn: body.coreTurn,
        system: getSceneSystem(body.scriptStyleId),
        model,
      },
    );
    recordAnthropicUsage({
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      operation: "scenes",
      model: usedModel,
      usage,
    });
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
