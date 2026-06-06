"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageBatch, Scene, VisualBible } from "@/lib/types";
import {
  composeImagePrompt,
  composeReferencePrompt,
  styleForScene,
} from "@/lib/styles";
import {
  cancelImageBatch,
  getImageBatch,
  submitImageBatch,
  type ImageBatchRequestInput,
} from "@/lib/storage";
import { ImageIcon, Spinner } from "./icons";

/**
 * Project-level "generate many images in one async Gemini batch" panel — 50%
 * cheaper than one-at-a-time, runs in the background even if the tab closes. Two
 * independent actions: bible reference images, and scene starting frames. Only
 * one batch runs at a time (submitting while one is open is rejected). The actual
 * storing happens server-side in the image-batch poller; this UI submits, shows
 * progress (polling the cheap status endpoint), and lifts saved-image keys up.
 */
export default function ImageBatchPanel({
  projectId,
  bible,
  scenes,
  styleId,
  conceptStyleId,
  imageModelId,
  images,
  imageBatch,
  onImageBatchChange,
  onImagesSaved,
}: {
  projectId: string;
  bible: VisualBible;
  scenes: Scene[];
  styleId: string;
  conceptStyleId?: string;
  imageModelId?: string;
  images: Set<string>;
  imageBatch: ImageBatch | null;
  onImageBatchChange: (b: ImageBatch | null) => void;
  /** Newly stored image keys as `${scope}:${imageKey}` strings. */
  onImagesSaved: (keys: string[]) => void;
}) {
  const open = imageBatch?.status === "open";

  const entities = useMemo(
    () =>
      [
        ...bible.characters.map((c) => ({ entity: c, kind: "character" as const })),
        ...bible.locations.map((l) => ({ entity: l, kind: "location" as const })),
      ],
    [bible],
  );

  const [refSel, setRefSel] = useState<Set<string>>(new Set());
  const [sceneSel, setSceneSel] = useState<Set<number>>(new Set());
  // Which group is currently submitting (so only that button shows a spinner).
  const [busyScope, setBusyScope] = useState<"ref" | "scene" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // batchKeys already reported up to Studio, so we only bump on newly stored ones.
  const reportedRef = useRef<Set<string>>(new Set());

  // Default selection = items that don't already have an image, recomputed when
  // the underlying sets change and no batch is open.
  useEffect(() => {
    if (open) return;
    setRefSel(
      new Set(
        entities
          .filter(({ entity }) => !images.has(`ref:${entity.id}`))
          .map(({ entity }) => entity.id),
      ),
    );
    setSceneSel(
      new Set(
        scenes
          .filter((s) => !images.has(`scene:${s.index}`))
          .map((s) => s.index),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entities.length, scenes.length, images.size]);

  // While a batch is open and the tab is visible, poll the cheap status endpoint
  // for display; the server poller is what actually stores the images.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function poll() {
      if (typeof document !== "undefined" && document.hidden) return;
      const b = await getImageBatch(projectId);
      if (cancelled || !b) return;
      onImageBatchChange(b);
      const fresh = b.requests
        .filter(
          (r) => r.state === "downloaded" && !reportedRef.current.has(r.batchKey),
        )
        .map((r) => {
          reportedRef.current.add(r.batchKey);
          return `${r.scope}:${r.imageKey}`;
        });
      if (fresh.length) onImagesSaved(fresh);
    }
    const timer = setInterval(() => void poll(), 12_000);
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
  }, [open, projectId, imageBatch?.batchId, onImageBatchChange, onImagesSaved]);

  function refInputs(ids: Set<string>): ImageBatchRequestInput[] {
    return entities
      .filter(({ entity }) => ids.has(entity.id))
      .map(({ entity, kind }) => ({
        scope: "ref" as const,
        key: entity.id,
        prompt: composeReferencePrompt(entity, styleId, kind),
        aspectRatio: "1:1",
        label: entity.name,
      }));
  }

  function sceneInputs(indices: Set<number>): ImageBatchRequestInput[] {
    return scenes
      .filter((s) => indices.has(s.index))
      .map((s) => ({
        scope: "scene" as const,
        key: String(s.index),
        prompt: composeImagePrompt(
          s.imagePrompt,
          styleForScene(s, styleId, conceptStyleId),
        ),
        referenceKeys: [...(s.characterIds ?? []), ...(s.locationIds ?? [])],
        aspectRatio: "9:16",
        label: `Scene ${s.index + 1}`,
      }));
  }

  async function submit(
    requests: ImageBatchRequestInput[],
    scope: "ref" | "scene",
  ) {
    if (busyScope || requests.length === 0) return;
    setBusyScope(scope);
    setError(null);
    try {
      const { imageBatch: b } = await submitImageBatch(
        projectId,
        requests,
        imageModelId,
      );
      reportedRef.current = new Set();
      onImageBatchChange(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the batch.");
    } finally {
      setBusyScope(null);
    }
  }

  async function cancel() {
    onImageBatchChange(await cancelImageBatch(projectId));
  }

  if (entities.length === 0 && scenes.length === 0) return null;

  return (
    <section className="surface overflow-hidden border-twilight-300/25">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-twilight-300/5 px-5 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-twilight-300">
          <ImageIcon width={15} height={15} />
          Batch images (Gemini)
        </span>
        <span className="text-xs text-faint">
          Generate many images in one cheap async job (~50% off) — runs in the
          background, even if you close this tab.
        </span>
      </div>

      <div className="space-y-5 px-5 py-4">
        {open ? (
          <OpenView imageBatch={imageBatch!} onCancel={cancel} />
        ) : (
          <>
            <SelectGroup
              title="Bible references"
              hint="Generate each entity's reference image first — scene frames reuse them for consistency."
              items={entities.map(({ entity }) => ({
                id: entity.id,
                label: entity.name,
                done: images.has(`ref:${entity.id}`),
              }))}
              selected={refSel}
              onToggle={(id) =>
                setRefSel((p) => {
                  const n = new Set(p);
                  if (n.has(id as string)) n.delete(id as string);
                  else n.add(id as string);
                  return n;
                })
              }
              onAll={() => setRefSel(new Set(entities.map((e) => e.entity.id)))}
              onNone={() => setRefSel(new Set())}
              busy={busyScope !== null}
              submitting={busyScope === "ref"}
              lastBatch={imageBatch}
              scope="ref"
              onSubmit={() => submit(refInputs(refSel), "ref")}
              onRetryFailed={(keys) =>
                submit(refInputs(new Set(keys as string[])), "ref")
              }
            />

            {scenes.length > 0 && (
              <SelectGroup
                title="Scene starting frames"
                hint="Each frame inlines its scene's reference images (generate those first)."
                items={scenes.map((s) => ({
                  id: s.index,
                  label: String(s.index + 1).padStart(2, "0"),
                  done: images.has(`scene:${s.index}`),
                }))}
                selected={sceneSel}
                onToggle={(id) =>
                  setSceneSel((p) => {
                    const n = new Set(p);
                    if (n.has(id as number)) n.delete(id as number);
                    else n.add(id as number);
                    return n;
                  })
                }
                onAll={() => setSceneSel(new Set(scenes.map((s) => s.index)))}
                onNone={() => setSceneSel(new Set())}
                busy={busyScope !== null}
                submitting={busyScope === "scene"}
                lastBatch={imageBatch}
                scope="scene"
                onSubmit={() => submit(sceneInputs(sceneSel), "scene")}
                onRetryFailed={(keys) =>
                  submit(
                    sceneInputs(new Set((keys as string[]).map((k) => Number(k)))),
                    "scene",
                  )
                }
                mono
              />
            )}
          </>
        )}

        {error && <p className="text-xs text-ember-300">{error}</p>}
      </div>
    </section>
  );
}

function OpenView({
  imageBatch,
  onCancel,
}: {
  imageBatch: ImageBatch;
  onCancel: () => void;
}) {
  const total = imageBatch.requests.length;
  const done = imageBatch.requests.filter((r) => r.state === "downloaded").length;
  const failed = imageBatch.requests.filter((r) => r.state === "failed").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted">
          {done}/{total} images ready
          {failed > 0 && <span className="text-ember-300"> · {failed} failed</span>}
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
          className="h-full rounded-full bg-twilight-300 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {imageBatch.requests.map((r) => (
          <span
            key={r.batchKey}
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
            {r.scope === "scene" ? "#" : ""}
            {r.label}
          </span>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[0.68rem] text-faint">
        <Spinner width={11} height={11} /> Processing in the background — images
        appear together when the job finishes (minutes to hours).
      </p>
    </div>
  );
}

type GroupId = string | number;

function SelectGroup({
  title,
  hint,
  items,
  selected,
  onToggle,
  onAll,
  onNone,
  busy,
  submitting,
  lastBatch,
  scope,
  onSubmit,
  onRetryFailed,
  mono,
}: {
  title: string;
  hint: string;
  items: { id: GroupId; label: string; done: boolean }[];
  selected: Set<GroupId>;
  onToggle: (id: GroupId) => void;
  onAll: () => void;
  onNone: () => void;
  /** True while EITHER group is submitting — disables this group's button. */
  busy: boolean;
  /** True only while THIS group is submitting — shows the spinner. */
  submitting: boolean;
  lastBatch: ImageBatch | null;
  scope: "ref" | "scene";
  onSubmit: () => void;
  onRetryFailed: (keys: string[]) => void;
  mono?: boolean;
}) {
  // Failed image keys from the last batch for THIS scope (offer a one-click retry).
  const failedKeys =
    lastBatch?.requests
      .filter((r) => r.scope === scope && r.state === "failed")
      .map((r) => r.imageKey) ?? [];
  const terminal =
    lastBatch &&
    lastBatch.status !== "open" &&
    lastBatch.requests.some((r) => r.scope === scope);

  if (items.length === 0) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-cream">{title}</h4>
        <p className="mt-1 text-xs text-faint">Nothing to generate yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-cream">{title}</h4>
        <div className="flex items-center gap-2 text-xs text-faint">
          <span>
            {selected.size}/{items.length}
          </span>
          <button type="button" onClick={onAll} className="underline hover:text-cream">
            all
          </button>
          <span>·</span>
          <button type="button" onClick={onNone} className="underline hover:text-cream">
            none
          </button>
        </div>
      </div>
      <p className="mt-0.5 text-[0.68rem] text-faint">{hint}</p>

      {terminal && failedKeys.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onRetryFailed(failedKeys)}
          className="btn btn-ghost mt-2 !px-2.5 !py-1 !text-xs text-ember-300"
        >
          Retry {failedKeys.length} failed
        </button>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((it) => {
          const on = selected.has(it.id);
          return (
            <button
              key={String(it.id)}
              type="button"
              onClick={() => onToggle(it.id)}
              title={it.done ? `${it.label} — already generated` : it.label}
              className={`relative max-w-[10rem] truncate rounded-md border px-2.5 py-1 text-xs transition ${
                mono ? "font-mono" : ""
              } ${
                on
                  ? "border-twilight-300/60 bg-twilight-300/15 text-twilight-300"
                  : "border-[var(--line)] bg-ink-950/40 text-faint hover:text-cream"
              }`}
            >
              {it.done && <span className="mr-1 text-mint-400">✓</span>}
              {it.label}
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
        {submitting ? (
          <>
            <Spinner width={13} height={13} /> Submitting…
          </>
        ) : (
          `Generate ${selected.size} ${scope === "ref" ? "reference" : "frame"}${
            selected.size === 1 ? "" : "s"
          } (batch)`
        )}
      </button>
    </div>
  );
}
