import { NextResponse } from "next/server";
import { deleteProject, getProject, upsertProject } from "@/server/db";
import { apiError } from "@/lib/http";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const project = getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Project;
    body.id = id;
    upsertProject(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
