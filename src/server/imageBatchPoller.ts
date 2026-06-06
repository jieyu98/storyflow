// Background poller for async Gemini image batches (Nano Banana Batch API).
// Mirrors clipBatchPoller: started at boot + on each submit, it advances every
// open batch on a timer. Gemini returns ALL results at once in a single file, so
// each tick just refreshes the job state and — once the job is terminal —
// downloads the results JSONL, stores every generated image, and closes the
// batch. Wrapped so a throw can never crash the server; the interval stops itself
// when no batches are open and re-arms on the next submit.

import {
  getImageBatch,
  listOpenImageBatchProjectIds,
  saveImage,
  saveImageBatch,
} from "./db";
import { getImageBatchResults, getImageBatchStatus } from "@/lib/geminiBatch";

const TICK_MS = 20_000;

const g = globalThis as unknown as {
  __imageBatchPoller?: { timer: ReturnType<typeof setInterval> | null };
};

let ticking = false;

/** Advance one project's open batch: refresh state → on terminal, store results. */
async function advanceBatch(projectId: string): Promise<void> {
  const batch = getImageBatch(projectId);
  if (!batch || batch.status !== "open") return;

  let status;
  try {
    status = await getImageBatchStatus(batch.batchId);
  } catch (err) {
    console.error(
      `[storyflow] image-batch ${batch.batchId}: status poll failed, retrying next tick:`,
      err,
    );
    return; // transient — retry next tick (batch stays open)
  }
  batch.jobState = status.state;

  // Still running — just persist the latest state for the UI.
  if (!status.done) {
    saveImageBatch(projectId, batch);
    return;
  }

  if (status.phase === "SUCCEEDED" && status.resultFile) {
    let results;
    try {
      results = await getImageBatchResults(status.resultFile);
    } catch (err) {
      // Job is done but the results file isn't readable yet — keep the batch
      // open and retry the download next tick.
      console.error(
        `[storyflow] image-batch ${batch.batchId}: results download failed, retrying next tick:`,
        err,
      );
      saveImageBatch(projectId, batch);
      return;
    }
    const keyed = results.filter((r) => r.key);
    const byKey = new Map(keyed.map((r) => [r.key as string, r]));
    // The results file echoes our `key` per line; if for any reason it doesn't,
    // fall back to positional matching (file lines are in submit order).
    const positional =
      keyed.length === 0 && results.length === batch.requests.length;
    batch.requests.forEach((req, i) => {
      if (req.state !== "pending") return;
      const r = positional ? results[i] : byKey.get(req.batchKey);
      if (r?.image) {
        try {
          saveImage(
            projectId,
            req.scope,
            req.imageKey,
            r.image.mime,
            Buffer.from(r.image.base64, "base64"),
          );
          req.state = "downloaded";
        } catch {
          req.state = "failed";
          req.error = "Could not store the generated image.";
        }
      } else {
        req.state = "failed";
        req.error = r?.error ?? "No result returned for this request.";
      }
    });
    const failed = batch.requests.filter((r) => r.state === "failed");
    if (failed.length) {
      console.error(
        `[storyflow] image-batch ${batch.batchId}: ${failed.length}/${batch.requests.length} request(s) failed:`,
        failed.map((f) => ({ key: f.imageKey, error: f.error })),
      );
    }
    batch.status = "complete";
  } else if (status.phase === "CANCELLED") {
    batch.status = "cancelled";
    for (const req of batch.requests) {
      if (req.state === "pending") req.state = "failed";
    }
  } else {
    // FAILED or EXPIRED (or succeeded with no result file — treat as failure).
    console.error(
      `[storyflow] image-batch ${batch.batchId}: job ended ${status.state}` +
        (status.error ? ` — ${status.error}` : ""),
    );
    batch.status = "failed";
    for (const req of batch.requests) {
      if (req.state === "pending") {
        req.state = "failed";
        req.error = req.error ?? status.error ?? status.state;
      }
    }
  }
  saveImageBatch(projectId, batch);
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const ids = listOpenImageBatchProjectIds();
    if (ids.length === 0) {
      // Idle — stop the interval; ensureImageBatchPoller() re-arms on submit.
      if (g.__imageBatchPoller?.timer) {
        clearInterval(g.__imageBatchPoller.timer);
        g.__imageBatchPoller.timer = null;
      }
      return;
    }
    for (const id of ids) {
      try {
        await advanceBatch(id);
      } catch (err) {
        // One bad batch never stops the others.
        console.error("[storyflow] image-batch poller: advance failed for", id, err);
      }
    }
  } catch {
    // Never let the poller crash the process.
  } finally {
    ticking = false;
  }
}

/** Idempotently start the poller. Safe to call repeatedly. */
export function ensureImageBatchPoller(): void {
  if (!g.__imageBatchPoller) g.__imageBatchPoller = { timer: null };
  if (g.__imageBatchPoller.timer) return;
  g.__imageBatchPoller.timer = setInterval(() => void tick(), TICK_MS);
  void tick(); // kick once immediately
}
