// Background poller for async Grok clip batches. Runs in the Node server while
// the dev server is up (started from instrumentation.ts at boot and from the
// batch submit route). Every tick it advances each open batch: refresh status,
// download any finished clips IMMEDIATELY (signed URLs expire ~1h after
// retrieval), store them, and meter cost. No HTTP/tab required — true
// fire-and-forget. The whole thing is wrapped so a throw can never crash the
// server, and the interval stops itself when no batches are open.

import {
  getClipBatch,
  listOpenClipBatchProjectIds,
  saveClip,
  saveClipBatch,
} from "./db";
import { getBatch, getBatchResults } from "@/lib/grok";
import { recordGrokBatchUsage } from "./usage";

const TICK_MS = 20_000;

const g = globalThis as unknown as {
  __clipBatchPoller?: { timer: ReturnType<typeof setInterval> | null };
};

let ticking = false;

/** Advance one project's open batch: status → download ready clips → meter. */
async function advanceBatch(projectId: string): Promise<void> {
  const batch = getClipBatch(projectId);
  if (!batch || batch.status !== "open") return;

  // 1. Refresh batch-level status + expiry.
  try {
    const { state, expiresAt } = await getBatch(batch.batchId);
    batch.counts = {
      total: state.num_requests,
      pending: state.num_pending,
      success: state.num_success,
      error: state.num_error,
    };
    if (expiresAt) batch.expiresAt = expiresAt;
  } catch {
    // Transient — retry next tick.
  }

  if (batch.expiresAt && batch.expiresAt < Date.now()) {
    batch.status = "expired";
    saveClipBatch(projectId, batch);
    return;
  }

  // 2. Drain results, downloading anything not already saved.
  const byReqId = new Map(batch.requests.map((r) => [r.batchRequestId, r]));
  let token: string | undefined;
  let newTicks = 0;
  do {
    let page;
    try {
      page = await getBatchResults(batch.batchId, token);
    } catch {
      break; // retry next tick
    }
    for (const res of page.results) {
      const req = byReqId.get(res.batchRequestId);
      if (!req || req.state === "downloaded") continue;
      if (res.errorMessage && !res.videoUrl) {
        req.state = "failed";
        req.error = res.errorMessage;
        continue;
      }
      if (res.videoUrl) {
        try {
          const dl = await fetch(res.videoUrl, { cache: "no-store" });
          if (!dl.ok) throw new Error(`download ${dl.status}`);
          const buf = Buffer.from(await dl.arrayBuffer());
          saveClip(projectId, req.sceneIndex, "video/mp4", buf);
          req.state = "downloaded";
          if (res.costTicks) newTicks += res.costTicks;
        } catch {
          // Leave pending; retry next tick (URL may have expired — re-fetch
          // results next pass yields a fresh signed URL).
        }
      }
    }
    token = page.paginationToken;
  } while (token);

  // 3. Meter only the cost of clips downloaded this pass (idempotent).
  if (newTicks > 0) {
    batch.costTicks = (batch.costTicks ?? 0) + newTicks;
    recordGrokBatchUsage({ projectId, costUsd: newTicks / 1e10 });
  }

  // 4. Complete only once xAI is done AND every request reached a terminal
  //    local state (so undownloaded successes keep being retried).
  const allResolved = batch.requests.every(
    (r) => r.state === "downloaded" || r.state === "failed",
  );
  if (batch.counts && batch.counts.pending === 0 && allResolved) {
    batch.status = "complete";
  }
  saveClipBatch(projectId, batch);
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const ids = listOpenClipBatchProjectIds();
    if (ids.length === 0) {
      // Idle — stop the interval; ensurePoller() re-arms on the next submit.
      if (g.__clipBatchPoller?.timer) {
        clearInterval(g.__clipBatchPoller.timer);
        g.__clipBatchPoller.timer = null;
      }
      return;
    }
    for (const id of ids) {
      try {
        await advanceBatch(id);
      } catch {
        // One bad batch never stops the others.
      }
    }
  } catch {
    // Never let the poller crash the process.
  } finally {
    ticking = false;
  }
}

/** Idempotently start the poller. Safe to call repeatedly. */
export function ensurePoller(): void {
  if (!g.__clipBatchPoller) g.__clipBatchPoller = { timer: null };
  if (g.__clipBatchPoller.timer) return;
  g.__clipBatchPoller.timer = setInterval(() => void tick(), TICK_MS);
  void tick(); // kick once immediately
}
