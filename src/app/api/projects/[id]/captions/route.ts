import { NextResponse } from "next/server";
import { getProject } from "@/server/db";
import { wordsFromAlignment } from "@/lib/alignment";
import { pickCaptionEmphasis } from "@/lib/anthropic";
import { recordAnthropicUsage } from "@/server/usage";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// Let Claude pick which caption words to emphasize. Returns the word indices;
// the client persists them on the project (so the preview + render pick them up).
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const project = getProject(id);
    if (!project?.alignment) {
      return NextResponse.json(
        { error: "Generate the voiceover first." },
        { status: 400 },
      );
    }
    const words = wordsFromAlignment(project.alignment);
    if (words.length === 0) {
      return NextResponse.json({ error: "No words to emphasize." }, { status: 400 });
    }
    const { indices, usage, model } = await pickCaptionEmphasis(words);
    recordAnthropicUsage({ projectId: id, operation: "captions", model, usage });
    return NextResponse.json({ indices });
  } catch (err) {
    return apiError(err);
  }
}
