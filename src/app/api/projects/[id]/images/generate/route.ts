import { NextResponse } from "next/server";
import { generateImage, type InlineImage } from "@/lib/gemini";
import { getImage, saveImage } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      scope?: string;
      key?: string;
      prompt?: string;
      referenceKeys?: string[];
      aspectRatio?: string;
    };

    const scope = body.scope === "scene" ? "scene" : "ref";
    const key = (body.key ?? "").trim();
    const prompt = (body.prompt ?? "").trim();
    if (!key || !prompt) {
      return NextResponse.json(
        { error: "Missing key or prompt." },
        { status: 400 },
      );
    }

    // Pull any reference images (always stored under scope 'ref') so the model
    // keeps the entity consistent across frames.
    const inputImages: InlineImage[] = [];
    for (const refKey of body.referenceKeys ?? []) {
      const ref = getImage(id, "ref", refKey);
      if (ref) {
        inputImages.push({ base64: ref.data.toString("base64"), mime: ref.mime });
      }
    }

    const img = await generateImage({
      prompt,
      inputImages,
      aspectRatio: body.aspectRatio ?? (scope === "scene" ? "9:16" : "1:1"),
    });

    saveImage(id, scope, key, img.mime, Buffer.from(img.base64, "base64"));
    return NextResponse.json({ ok: true, mime: img.mime });
  } catch (err) {
    return apiError(err);
  }
}
