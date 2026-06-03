import { NextResponse } from "next/server";
import { listClipIndexes } from "@/server/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ clips: listClipIndexes(id) });
  } catch (err) {
    return apiError(err);
  }
}
