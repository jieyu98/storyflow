import { NextResponse } from "next/server";
import {
  addVideoBatchRequests,
  cancelBatch,
  createBatch,
  type VideoBatchRequest,
} from "@/lib/grok";
import {
  getClipBatch,
  getImage,
  saveClipBatch,
} from "@/server/db";
import { ensurePoller } from "@/server/clipBatchPoller";
import { apiError } from "@/lib/http";
import type { ClipBatch } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Submitting inlines each selected scene's base64 starting frame; allow headroom.
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

type SceneInput = {
  index: number;
  prompt: string;
  duration?: number;
  aspectRatio?: string;
};

// Submit a new batch for the selected scenes (replaces any prior batch).
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = getClipBatch(id);
    if (existing && existing.status === "open") {
      return NextResponse.json(
        { error: "A clip batch is already running for this project." },
        { status: 409 },
      );
    }

    const body = (await req.json()) as { scenes?: SceneInput[] };
    const scenes = (body.scenes ?? []).filter(
      (s) => typeof s.index === "number" && (s.prompt ?? "").trim(),
    );
    if (scenes.length === 0) {
      return NextResponse.json(
        { error: "Select at least one scene with an animation prompt." },
        { status: 400 },
      );
    }

    // Only scenes that already have a master starting frame can be animated.
    const reqs: VideoBatchRequest[] = [];
    const sceneIndices: number[] = []; // real 0-based index, parallel to reqs
    const skipped: number[] = [];
    for (const s of scenes) {
      const frame = getImage(id, "scene", String(s.index));
      if (!frame) {
        skipped.push(s.index);
        continue;
      }
      reqs.push({
        // Label by the DISPLAYED (1-based) scene number so the xAI dashboard's
        // batch_request_id matches what the user sees in the app.
        batchRequestId: `scene-${s.index + 1}`,
        prompt: s.prompt.trim(),
        image: `data:${frame.mime};base64,${frame.data.toString("base64")}`,
        duration: s.duration,
        aspectRatio: s.aspectRatio ?? "9:16",
      });
      sceneIndices.push(s.index);
    }
    if (reqs.length === 0) {
      return NextResponse.json(
        { error: "None of the selected scenes have a starting frame yet." },
        { status: 400 },
      );
    }

    const batchId = await createBatch(`storyflow-${id}-${Date.now()}`);
    await addVideoBatchRequests(batchId, reqs);

    const clipBatch: ClipBatch = {
      batchId,
      createdAt: Date.now(),
      status: "open",
      requests: reqs.map((r, i) => ({
        sceneIndex: sceneIndices[i], // real index, decoupled from the label
        batchRequestId: r.batchRequestId,
        state: "pending",
      })),
      counts: { total: reqs.length, pending: reqs.length, success: 0, error: 0 },
      costTicks: 0,
    };
    saveClipBatch(id, clipBatch);
    ensurePoller();

    return NextResponse.json({ clipBatch, skipped });
  } catch (err) {
    return apiError(err);
  }
}

// Cheap status read (the poller keeps the stored state fresh — no xAI call here).
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json({ clipBatch: getClipBatch(id) });
  } catch (err) {
    return apiError(err);
  }
}

// Cancel: stop pending requests; already-downloaded clips are kept.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const batch = getClipBatch(id);
    if (!batch) return NextResponse.json({ clipBatch: null });
    try {
      await cancelBatch(batch.batchId);
    } catch {
      // Best-effort — mark cancelled locally regardless.
    }
    batch.status = "cancelled";
    saveClipBatch(id, batch);
    return NextResponse.json({ clipBatch: batch });
  } catch (err) {
    return apiError(err);
  }
}
