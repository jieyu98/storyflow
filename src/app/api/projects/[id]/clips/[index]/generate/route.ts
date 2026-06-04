import { NextResponse } from "next/server";
import { generateVideoAndWait } from "@/lib/grok";
import { getImage, saveClip } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string; index: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id, index } = await params;
    const sceneIndex = Number(index);
    const body = (await req.json()) as {
      prompt?: string;
      duration?: number;
      aspectRatio?: string;
    };
    const prompt = (body.prompt ?? "").trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing animation prompt." },
        { status: 400 },
      );
    }

    // Animate the scene's generated starting frame. Inline it as a data URI —
    // xAI can't fetch a localhost image URL.
    const frame = getImage(id, "scene", String(sceneIndex));
    if (!frame) {
      return NextResponse.json(
        { error: "Generate the scene's starting frame first." },
        { status: 400 },
      );
    }
    const image = `data:${frame.mime};base64,${frame.data.toString("base64")}`;

    const videoUrl = await generateVideoAndWait({
      prompt,
      image,
      duration: body.duration,
      aspectRatio: body.aspectRatio ?? "9:16",
    });

    // Download the finished mp4 and store it as this scene's clip.
    const dl = await fetch(videoUrl);
    if (!dl.ok) {
      return NextResponse.json(
        { error: `Could not download the generated video (${dl.status}).` },
        { status: 502 },
      );
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    saveClip(id, sceneIndex, "video/mp4", buf);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
