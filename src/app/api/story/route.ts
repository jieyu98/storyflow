import { NextResponse } from "next/server";
import { generateStory } from "@/lib/anthropic";
import { apiError } from "@/lib/http";
import { getScriptStyle } from "@/lib/scriptStyles";
import { recordAnthropicUsage } from "@/server/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      redditText?: unknown;
      scriptStyleId?: unknown;
      projectId?: unknown;
    };
    const redditText =
      typeof body.redditText === "string" ? body.redditText.trim() : "";
    if (redditText.length < 20) {
      return NextResponse.json(
        { error: "Paste some text first — at least a couple of sentences." },
        { status: 400 },
      );
    }
    const style = getScriptStyle(
      typeof body.scriptStyleId === "string" ? body.scriptStyleId : undefined,
    );
    const { result, usage, model } = await generateStory(
      redditText,
      style.system,
    );
    recordAnthropicUsage({
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      operation: "story",
      model,
      usage,
    });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
