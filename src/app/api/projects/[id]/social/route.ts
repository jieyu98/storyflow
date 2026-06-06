import { NextResponse } from "next/server";
import { getProject } from "@/server/db";
import { generateSocialCaption } from "@/lib/anthropic";
import { recordAnthropicUsage } from "@/server/usage";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

// Generate a short post caption + 5 hashtags from the story script (billed Claude
// call). The client persists the result on the project.
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const project = getProject(id);
    if (!project?.script?.trim()) {
      return NextResponse.json(
        { error: "Write a script first." },
        { status: 400 },
      );
    }
    const { description, hashtags, usage, model } = await generateSocialCaption({
      title: project.title,
      coreTurn: project.coreTurn,
      script: project.script,
    });
    recordAnthropicUsage({ projectId: id, operation: "social", model, usage });
    return NextResponse.json({ description, hashtags });
  } catch (err) {
    return apiError(err);
  }
}
