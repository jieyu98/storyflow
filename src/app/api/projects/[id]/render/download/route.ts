import { NextResponse } from "next/server";
import { getRenderMp4 } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const mp4 = getRenderMp4(id);
    if (!mp4) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(mp4), {
      headers: {
        "content-type": "video/mp4",
        "content-disposition": `attachment; filename="storyflow-${id}.mp4"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
