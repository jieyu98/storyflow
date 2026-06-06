import { NextResponse } from "next/server";
import { getProject } from "@/server/db";
import { generateBible } from "@/lib/anthropic";
import { recordAnthropicUsage } from "@/server/usage";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// Build a visual bible from the project's script (billed Claude call). For
// pasted scripts where the story agent (which normally builds the bible) was
// skipped. The client persists the returned bible on the project.
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const project = getProject(id);
    if (!project?.script?.trim()) {
      return NextResponse.json(
        { error: "Write or paste a script first." },
        { status: 400 },
      );
    }
    const { visualBible, usage, model } = await generateBible(project.script);
    recordAnthropicUsage({ projectId: id, operation: "bible", model, usage });
    return NextResponse.json({ visualBible });
  } catch (err) {
    return apiError(err);
  }
}
