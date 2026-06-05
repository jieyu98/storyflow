"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipBatch, Scene } from "@/lib/types";
import { composeImagePrompt, styleForScene } from "@/lib/styles";
import {
  cancelClipBatch,
  getClipBatch,
  submitClipBatch,
  type ClipBatchSceneInput,
} from "@/lib/storage";
import { MotionIcon, Spinner } from "./icons";

/**
 * Project-level "generate all selected clips in one async Grok batch" panel.
 * The actual downloading happens server-side in the background poller; this UI
 * only submits, shows progress (polling the cheap status endpoint while open),
 * and lifts saved-clip indices + batch state up to Studio.
 */
export default function ClipBatchPanel({
  projectId,
  scenes,
  styleId,
  conceptStyleId,
  images,
  clips,
  clipBatch,
  onClipBatchChange,
  onClipsSaved,
}: {
  projectId: string;
  scenes: Scene[];
  styleId: string;
  conceptStyleId?: string;
  images: Set<string>;
  clips: Set<number>;
  clipBatch: ClipBatch | null;
  onClipBatchChange: (cb: ClipBatch | null) => void;
  onClipsSaved: (indices: number[]) => void;
}) {
  const framed = useMemo(
    () => scenes.filter((s) => images.has(`scene:${s.index}`)),
    [scenes, images],
  );
  const open = clipBatch?.status === "open";

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  // Scene indices already reported up to Studio, so we only bump it on new ones.
  const reportedRef = useRef<Set<number>>(new Set());

  // Default selection = framed scenes that don't already have a clip. Recomputed
  // whenever the framed/clip sets change and no batch is open.
  useEffect(() => {
    if (open) return;
    setSelected(
      new Set(framed.filter((s) => !clips.has(s.index)).map((s) => s.index)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, framed.length, clips.size]);

  // While a batch is open and the tab is visible, poll the cheap status endpoint
  // for display; the server poller is what actually downloads the clips.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function poll() {
      if (typeof document !== "undefined" && document.hidden) return;
      const cb = await getClipBatch(projectId);
      if (cancelled || !cb) return;
      onClipBatchChange(cb);
      const fresh = cb.requests
        .filter((r) => r.state === "downloaded" && !reportedRef.current.has(r.sceneIndex))
        .map((r) => r.sceneIndex);
      if (fresh.length) {
        for (const i of fresh) reportedRef.current.add(i);
        onClipsSaved(fresh);
      }
    }
    const timer = setInterval(() => void poll(), 15_000);
    void poll();
    const onVis = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [open, projectId, clipBatch?.batchId, onClipBatchChange, onClipsSaved]);

  function payloadFor(indices: number[]): ClipBatchSceneInput[] {
    return indices.flatMap((i) => {
      const s = scenes.find((x) => x.index === i);
      if (!s) return [];
      const prompt =
        s.animationPrompt ??
        composeImagePrompt(s.imagePrompt, styleForScene(s, styleId, conceptStyleId));
      return [{ index: i, prompt, duration: s.assignedDuration, aspectRatio: "9:16" }];
    });
  }

  async function submit(indices: number[]) {
    if (busy || indices.length === 0) return;
    setBusy(true);
    setError(null);
    setSkipped([]);
    try {
      const { clipBatch: cb, skipped: sk } = await submitClipBatch(
        projectId,
        payloadFor(indices),
      );
      onClipBatchChange(cb);
      setSkipped(sk);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the batch.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    onClipBatchChange(await cancelClipBatch(projectId));
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <section className="surface overflow-hidden border-mint-400/25">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-mint-400/5 px-5 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-mint-400">
          <MotionIcon width={15} height={15} />
          Batch clips (Grok)
        </span>
        <span className="text-xs text-faint">
          Animate many scenes in one cheap async job — runs in the background, even
          if you close this tab.
        </span>
      </div>

      <div className="px-5 py-4">
        {open ? (
          <OpenView clipBatch={clipBatch!} onCancel={cancel} />
        ) : (
          <SubmitView
            framed={framed}
            selected={selected}
            busy={busy}
            lastBatch={clipBatch}
            onToggle={toggle}
            onSelectAll={() => setSelected(new Set(framed.map((s) => s.index)))}
            onSelectNone={() => setSelected(new Set())}
            onSubmit={() => submit([...selected])}
            onRetryFailed={(idx) => submit(idx)}
          />
        )}

        {skipped.length > 0 && (
          <p className="mt-2 text-xs text-faint">
            Skipped {skipped.length} scene{skipped.length > 1 ? "s" : ""} with no
            starting frame: {skipped.map((i) => i + 1).join(", ")}.
          </p>
        )}
        {error && <p className="mt-2 text-xs text-ember-300">{error}</p>}
      </div>
    </section>
  );
}

function OpenView({
  clipBatch,
  onCancel,
}: {
  clipBatch: ClipBatch;
  onCancel: () => void;
}) {
  const total = clipBatch.requests.length;
  const downloaded = clipBatch.requests.filter((r) => r.state === "downloaded").length;
  const failed = clipBatch.requests.filter((r) => r.state === "failed").length;
  const pct = total ? Math.round((downloaded / total) * 100) : 0;
  const expiresInH =
    clipBatch.expiresAt != null
      ? Math.max(0, Math.round((clipBatch.expiresAt - Date.now()) / 3.6e6))
      : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted">
          {downloaded}/{total} clips ready
          {failed > 0 && <span className="text-ember-300"> · {failed} failed</span>}
          {clipBatch.counts && (
            <span className="text-faint"> · {clipBatch.counts.pending} processing</span>
          )}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost !px-2.5 !py-1 !text-xs"
        >
          Cancel batch
        </button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-950/60">
        <div
          className="h-full rounded-full bg-mint-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {clipBatch.requests
          .slice()
          .sort((a, b) => a.sceneIndex - b.sceneIndex)
          .map((r) => (
            <span
              key={r.sceneIndex}
              title={r.error ?? r.state}
              className={`chip !text-[0.62rem] ${
                r.state === "downloaded"
                  ? "text-mint-400"
                  : r.state === "failed"
                    ? "text-ember-300"
                    : "text-faint"
              }`}
            >
              {r.state === "downloaded" ? "✓ " : r.state === "failed" ? "✕ " : ""}
              {r.sceneIndex + 1}
            </span>
          ))}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[0.68rem] text-faint">
        <Spinner width={11} height={11} /> Processing in the background — clips
        appear as they finish (minutes to hours).
        {expiresInH != null && ` Results expire in ~${expiresInH}h.`}
      </p>
      <p className="mt-1 text-[0.68rem] text-faint">
        Each clip animates the starting frame as it was when you submitted.
      </p>
    </div>
  );
}

function SubmitView({
  framed,
  selected,
  busy,
  lastBatch,
  onToggle,
  onSelectAll,
  onSelectNone,
  onSubmit,
  onRetryFailed,
}: {
  framed: Scene[];
  selected: Set<number>;
  busy: boolean;
  lastBatch: ClipBatch | null;
  onToggle: (i: number) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onSubmit: () => void;
  onRetryFailed: (indices: number[]) => void;
}) {
  const terminal =
    lastBatch &&
    (lastBatch.status === "complete" ||
      lastBatch.status === "cancelled" ||
      lastBatch.status === "expired");
  const failedIdx =
    lastBatch?.requests.filter((r) => r.state === "failed").map((r) => r.sceneIndex) ??
    [];

  if (framed.length === 0) {
    return (
      <p className="text-xs text-faint">
        Generate at least one scene&rsquo;s starting frame first — batch mode
        animates existing frames.
      </p>
    );
  }

  return (
    <div>
      {terminal && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="chip text-faint">last batch: {lastBatch!.status}</span>
          <span className="text-muted">
            {lastBatch!.requests.filter((r) => r.state === "downloaded").length}{" "}
            downloaded
            {failedIdx.length > 0 && (
              <span className="text-ember-300"> · {failedIdx.length} failed</span>
            )}
          </span>
          {failedIdx.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRetryFailed(failedIdx)}
              className="btn btn-ghost !px-2.5 !py-1 !text-xs"
            >
              Retry failed
            </button>
          )}
        </div>
      )}

      <div className="mb-2 flex items-center gap-2 text-xs text-faint">
        <span>
          Pick scenes ({selected.size}/{framed.length} selected):
        </span>
        <button type="button" onClick={onSelectAll} className="underline hover:text-cream">
          all
        </button>
        <span>·</span>
        <button type="button" onClick={onSelectNone} className="underline hover:text-cream">
          none
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {framed
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((s) => {
            const on = selected.has(s.index);
            return (
              <button
                key={s.index}
                type="button"
                onClick={() => onToggle(s.index)}
                title={s.name ?? `Scene ${s.index + 1}`}
                className={`rounded-md border px-2.5 py-1 font-mono text-xs transition ${
                  on
                    ? "border-mint-400/60 bg-mint-400/15 text-mint-400"
                    : "border-[var(--line)] bg-ink-950/40 text-faint hover:text-cream"
                }`}
              >
                {String(s.index + 1).padStart(2, "0")}
              </button>
            );
          })}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || selected.size === 0}
        className="btn btn-ember mt-3 !px-4 !py-2 !text-xs"
      >
        {busy ? (
          <>
            <Spinner width={13} height={13} /> Submitting…
          </>
        ) : (
          `Generate ${selected.size} clip${selected.size === 1 ? "" : "s"} (batch)`
        )}
      </button>
    </div>
  );
}
