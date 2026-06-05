import { NextResponse } from "next/server";
import { listImageVersions, setActiveImage } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; scope: string; key: string }> };

// List every stored version for a scene/ref image, newest first.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id, scope, key } = await params;
    const versions = listImageVersions(id, scope, decodeURIComponent(key));
    return NextResponse.json({ versions });
  } catch (err) {
    return apiError(err);
  }
}

// Promote one version to master: { id: number }.
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id, scope, key } = await params;
    const body = (await req.json()) as { id?: number };
    if (typeof body.id !== "number") {
      return NextResponse.json({ error: "Missing version id." }, { status: 400 });
    }
    setActiveImage(id, scope, decodeURIComponent(key), body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
