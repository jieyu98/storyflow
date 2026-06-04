import { NextResponse } from "next/server";
import { deleteImage, getImage } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; scope: string; key: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id, scope, key } = await params;
    const img = getImage(id, scope, decodeURIComponent(key));
    if (!img) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(img.data), {
      headers: {
        "content-type": img.mime || "image/png",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id, scope, key } = await params;
    deleteImage(id, scope, decodeURIComponent(key));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
