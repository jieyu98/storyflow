import { NextResponse } from "next/server";
import {
  getAudio,
  getProject,
  getRender,
  listClipIndexes,
  startRender,
} from "@/server/db";
import { isRendering, startRenderJob } from "@/server/videoRenderer";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Returns fast; the render itself runs in a background child process.
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

// Start a background render. Requires every scene to have a clip + a voiceover.
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const project = getProject(id);
    if (!project || !project.scenes?.length) {
      return NextResponse.json(
        { error: "Cut scenes before rendering." },
        { status: 400 },
      );
    }
    const have = new Set(listClipIndexes(id).map((c) => c.index));
    const missing = project.scenes
      .filter((s) => !have.has(s.index))
      .map((s) => s.index);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Some scenes don't have a clip yet.", missing },
        { status: 400 },
      );
    }
    if (!getAudio(id)) {
      return NextResponse.json(
        { error: "Generate the voiceover first." },
        { status: 400 },
      );
    }
    const cur = getRender(id);
    if (isRendering() || cur?.status === "rendering") {
      return NextResponse.json(
        { error: "A render is already in progress." },
        { status: 409 },
      );
    }

    startRender(id);
    startRenderJob(id); // fire-and-forget background job

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

// Cheap status read (no BLOB) for polling.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const r = getRender(id);
    return NextResponse.json({
      render: r ?? { status: "idle", progress: 0, error: null, hasMp4: false },
    });
  } catch (err) {
    return apiError(err);
  }
}
