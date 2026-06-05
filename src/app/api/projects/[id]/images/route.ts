import { NextResponse } from "next/server";
import { deleteImagesByScope, listImageKeys } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ images: listImageKeys(id) });
  } catch (err) {
    return apiError(err);
  }
}

// DELETE /api/projects/[id]/images?scope=scene — drop every image under one scope.
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const scope = new URL(req.url).searchParams.get("scope");
    if (!scope) {
      return NextResponse.json(
        { error: "A `scope` query param is required." },
        { status: 400 },
      );
    }
    deleteImagesByScope(id, scope);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
