import { NextResponse } from "next/server";
import {
  deleteImage,
  deleteImageVersion,
  getImage,
  getImageVersion,
  saveImage,
} from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; scope: string; key: string }> };

// Upload your own image (generated outside the app) as this key's frame. Stored
// as a new active version, exactly like an in-app generation — the old versions
// are kept and the upload becomes the master.
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id, scope, key } = await params;
    if (scope !== "scene" && scope !== "ref") {
      return NextResponse.json({ error: "Unknown image scope." }, { status: 400 });
    }
    const mime = req.headers.get("content-type") || "image/png";
    if (!mime.startsWith("image/")) {
      return NextResponse.json(
        { error: "Expected an image file." },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: "Empty upload." }, { status: 400 });
    }
    saveImage(id, scope, decodeURIComponent(key), mime, buf);
    return NextResponse.json({ ok: true, mime });
  } catch (err) {
    return apiError(err);
  }
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id, scope, key } = await params;
    const idParam = new URL(req.url).searchParams.get("id");
    // `?id=` serves a specific version (history thumbnail); otherwise the master.
    const img = idParam
      ? getImageVersion(id, Number(idParam))
      : getImage(id, scope, decodeURIComponent(key));
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

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id, scope, key } = await params;
    const idParam = new URL(req.url).searchParams.get("id");
    // `?id=` deletes just that version; otherwise every version for the key.
    if (idParam) {
      deleteImageVersion(id, scope, decodeURIComponent(key), Number(idParam));
    } else {
      deleteImage(id, scope, decodeURIComponent(key));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
