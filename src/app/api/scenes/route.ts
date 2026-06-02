import { NextResponse } from "next/server";
import { generateScenePrompts } from "@/lib/anthropic";
import { apiError } from "@/lib/http";
import type { VisualBible } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const EMPTY_BIBLE: VisualBible = { characters: [], locations: [] };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      scenes?: { index: number; text: string; assignedDuration: number }[];
      visualBible?: VisualBible;
    };
    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    if (scenes.length === 0) {
      return NextResponse.json(
        { error: "No scenes to write prompts for." },
        { status: 400 },
      );
    }
    const prompts = await generateScenePrompts(
      scenes.map((s) => ({
        index: s.index,
        text: s.text,
        assignedDuration: s.assignedDuration as 4 | 6 | 8 | 10,
      })),
      body.visualBible ?? EMPTY_BIBLE,
    );
    return NextResponse.json({ scenes: prompts });
  } catch (err) {
    return apiError(err);
  }
}
