import { NextResponse } from "next/server";
import { getAudio, saveAudio } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const mp3 = getAudio(id);
    if (!mp3) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(mp3), {
      headers: {
        "content-type": "audio/mpeg",
        "content-length": String(mp3.length),
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: "Empty audio." }, { status: 400 });
    }
    saveAudio(id, buf);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
