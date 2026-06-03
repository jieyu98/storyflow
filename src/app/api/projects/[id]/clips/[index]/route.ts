import { NextResponse } from "next/server";
import { deleteClip, getClip, saveClip } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; index: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id, index } = await params;
    const clip = getClip(id, Number(index));
    if (!clip) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(clip.video), {
      headers: {
        "content-type": clip.mime || "video/mp4",
        "content-length": String(clip.video.length),
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id, index } = await params;
    const mime = req.headers.get("content-type") || "video/mp4";
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: "Empty clip." }, { status: 400 });
    }
    saveClip(id, Number(index), mime, buf);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id, index } = await params;
    deleteClip(id, Number(index));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
