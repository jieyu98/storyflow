"use client";

import { useEffect, useState } from "react";
import {
  getRenderStatus,
  renderDownloadUrl,
  startRender,
  type RenderStatus,
} from "@/lib/storage";
import { MotionIcon, PlayIcon, Spinner } from "./icons";

/**
 * In-app final render: bundles the same 9:16 composition the preview uses and
 * exports a downloadable MP4 (clips + voiceover + optional karaoke captions).
 * The render runs server-side in the background; this panel submits it, polls
 * status, and offers the download. Requires every scene to have a clip.
 */
export default function RenderPanel({
  projectId,
  sceneCount,
  clipCount,
  hasAudio,
  captions,
  onCaptionsChange,
  emphasisCount,
  onGenerateEmphasis,
}: {
  projectId: string;
  sceneCount: number;
  clipCount: number;
  hasAudio: boolean;
  captions: boolean;
  onCaptionsChange: (on: boolean) => void;
  emphasisCount: number;
  onGenerateEmphasis: () => Promise<void>;
}) {
  const [status, setStatus] = useState<RenderStatus>({
    status: "idle",
    progress: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emphBusy, setEmphBusy] = useState(false);

  async function genEmphasis() {
    if (emphBusy) return;
    setEmphBusy(true);
    setError(null);
    try {
      await onGenerateEmphasis();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't pick emphasis.");
    } finally {
      setEmphBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void getRenderStatus(projectId).then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Poll while rendering (visibility-gated).
  useEffect(() => {
    if (status.status !== "rendering") return;
    let cancelled = false;
    async function poll() {
      if (typeof document !== "undefined" && document.hidden) return;
      const s = await getRenderStatus(projectId);
      if (!cancelled) setStatus(s);
    }
    const t = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [status.status, projectId]);

  const allClips = sceneCount > 0 && clipCount >= sceneCount;
  const rendering = status.status === "rendering";
  const canRender = allClips && hasAudio && !rendering;

  async function render() {
    if (busy || rendering) return;
    setBusy(true);
    setError(null);
    try {
      await startRender(projectId);
      setStatus({ status: "rendering", progress: 0 });
    } catch (e) {
      const err = e as Error & { missing?: number[] };
      let msg = err.message;
      if (err.missing?.length)
        msg += ` (scenes ${err.missing.map((i) => i + 1).join(", ")})`;
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface overflow-hidden border-ember-500/25">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-ember-500/5 px-5 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ember-300">
          <MotionIcon width={15} height={15} />
          Render video
        </span>
        <span className="text-xs text-faint">
          Export the final 9:16 MP4 in-app — clips + voiceover{captions ? " + captions" : ""}.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {captions && (
            <button
              type="button"
              onClick={genEmphasis}
              disabled={emphBusy}
              className="btn btn-ghost !px-3 !py-1.5 !text-xs"
              title="Let Claude pick which caption words pop in the accent colour"
            >
              {emphBusy ? (
                <>
                  <Spinner width={12} height={12} /> Picking…
                </>
              ) : emphasisCount > 0 ? (
                `AI emphasis · ${emphasisCount} (re-pick)`
              ) : (
                "AI emphasis"
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onCaptionsChange(!captions)}
            className={`btn !px-3 !py-1.5 !text-xs ${
              captions ? "btn-ember" : "btn-ghost opacity-80"
            }`}
            title="Burn karaoke captions into the render (also shown in the preview)"
          >
            Karaoke captions {captions ? "on" : "off"}
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {rendering ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
              <span>
                {status.progress > 0
                  ? `Rendering… ${Math.round(status.progress * 100)}%`
                  : "Preparing renderer…"}
              </span>
              <span className="flex items-center gap-1.5 text-faint">
                <Spinner width={11} height={11} /> runs in the background
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-950/60">
              <div
                className="h-full rounded-full bg-ember-500 transition-all"
                style={{ width: `${Math.max(2, Math.round(status.progress * 100))}%` }}
              />
            </div>
            {status.progress === 0 && (
              <p className="mt-2 text-[0.68rem] text-faint">
                First render downloads a headless browser (~once) — this can take a
                minute before progress moves.
              </p>
            )}
          </div>
        ) : status.status === "done" && status.hasMp4 ? (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={renderDownloadUrl(projectId)}
              download
              className="btn btn-ember !px-4 !py-2 !text-xs"
            >
              <PlayIcon width={12} height={12} /> Download MP4
            </a>
            <button
              type="button"
              onClick={render}
              disabled={busy || !canRender}
              className="btn btn-ghost !px-3 !py-2 !text-xs"
            >
              Re-render
            </button>
            <span className="text-xs text-faint">Done.</span>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={render}
              disabled={busy || !canRender}
              className="btn btn-ember !px-4 !py-2 !text-xs"
              title={
                canRender
                  ? "Render the final video"
                  : "Need every scene clipped + a voiceover first"
              }
            >
              {busy ? (
                <>
                  <Spinner width={13} height={13} /> Starting…
                </>
              ) : (
                "Render video"
              )}
            </button>
            {!allClips && (
              <p className="mt-2 text-xs text-faint">
                {clipCount}/{sceneCount} scenes have a clip — generate the rest
                (or upload them) before rendering.
              </p>
            )}
            {allClips && !hasAudio && (
              <p className="mt-2 text-xs text-faint">
                Generate the voiceover first.
              </p>
            )}
            {status.status === "error" && status.error && (
              <p className="mt-2 text-xs text-ember-300">
                Last render failed: {status.error}
              </p>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-ember-300">{error}</p>}
      </div>
    </section>
  );
}
