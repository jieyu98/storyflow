import { NextResponse } from "next/server";
import {
  cancelImageBatch,
  createImageBatch,
  type BatchImageRequest,
} from "@/lib/geminiBatch";
import type { InlineImage } from "@/lib/gemini";
import { getImage, getImageBatch, saveImageBatch } from "@/server/db";
import { ensureImageBatchPoller } from "@/server/imageBatchPoller";
import { apiError } from "@/lib/http";
import { GEMINI_IMAGE_MODEL } from "@/server/env";
import { IMAGE_MODELS, type ImageBatch } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Submitting inlines each request's reference images + uploads the JSONL; allow
// headroom for larger projects.
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

type ReqInput = {
  scope?: string;
  key?: string;
  prompt?: string;
  referenceKeys?: string[];
  aspectRatio?: string;
  label?: string;
};

// Submit a new image batch (refs and/or scene frames). Replaces any prior batch
// unless one is still open (409).
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const existing = getImageBatch(id);
    if (existing && existing.status === "open") {
      return NextResponse.json(
        { error: "An image batch is already running for this project." },
        { status: 409 },
      );
    }

    const body = (await req.json()) as {
      requests?: ReqInput[];
      imageModelId?: string;
    };
    const inputs = (body.requests ?? []).filter(
      (r) =>
        (r.scope === "ref" || r.scope === "scene") &&
        (r.key ?? "").trim() &&
        (r.prompt ?? "").trim(),
    );
    if (inputs.length === 0) {
      return NextResponse.json(
        { error: "Select at least one image to generate." },
        { status: 400 },
      );
    }

    // Only honor a model from the known allowlist; else use the server default.
    const model = IMAGE_MODELS.some((m) => m.id === body.imageModelId)
      ? (body.imageModelId as string)
      : GEMINI_IMAGE_MODEL;

    const batchReqs: BatchImageRequest[] = [];
    const requests: ImageBatch["requests"] = [];
    inputs.forEach((r, i) => {
      const scope = r.scope as "ref" | "scene";
      const imageKey = (r.key as string).trim();
      const batchKey = `req-${i}`;

      // Inline any reference images (always stored under scope "ref") so the
      // model keeps the entity consistent across separately generated frames.
      const inputImages: InlineImage[] = [];
      for (const refKey of r.referenceKeys ?? []) {
        const ref = getImage(id, "ref", refKey);
        if (ref) {
          inputImages.push({
            base64: ref.data.toString("base64"),
            mime: ref.mime,
          });
        }
      }

      batchReqs.push({
        key: batchKey,
        prompt: (r.prompt as string).trim(),
        inputImages,
        aspectRatio: r.aspectRatio ?? (scope === "scene" ? "9:16" : "1:1"),
      });
      requests.push({
        scope,
        imageKey,
        batchKey,
        label: r.label ?? imageKey,
        state: "pending",
      });
    });

    const { batchId, inputFile } = await createImageBatch(
      batchReqs,
      model,
      `storyflow-${id}-${Date.now()}`,
    );

    const imageBatch: ImageBatch = {
      batchId,
      inputFile,
      createdAt: Date.now(),
      status: "open",
      requests,
      jobState: "JOB_STATE_PENDING",
    };
    saveImageBatch(id, imageBatch);
    ensureImageBatchPoller();

    return NextResponse.json({ imageBatch });
  } catch (err) {
    console.error("[storyflow] image-batch submit failed:", err);
    return apiError(err);
  }
}

// Cheap status read (the poller keeps the stored state fresh — no Gemini call).
// If a batch is still open, (re-)arm the poller defensively — self-heals if the
// background loop ever stopped (idle, crash, or a dev-server hot-reload).
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const imageBatch = getImageBatch(id);
    if (imageBatch?.status === "open") ensureImageBatchPoller();
    return NextResponse.json({ imageBatch });
  } catch (err) {
    return apiError(err);
  }
}

// Cancel: stop pending requests; already-stored images are kept.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const batch = getImageBatch(id);
    if (!batch) return NextResponse.json({ imageBatch: null });
    try {
      await cancelImageBatch(batch.batchId);
    } catch {
      // Best-effort — mark cancelled locally regardless.
    }
    batch.status = "cancelled";
    saveImageBatch(id, batch);
    return NextResponse.json({ imageBatch: batch });
  } catch (err) {
    return apiError(err);
  }
}
