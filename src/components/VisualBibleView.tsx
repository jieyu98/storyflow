"use client";

import { useState } from "react";
import type { VisualBible } from "@/lib/types";
import { composeReferencePrompt } from "@/lib/styles";
import { imageUrl, type ImageScope } from "@/lib/storage";
import CopyButton from "./CopyButton";
import {
  CheckIcon,
  ChevronDownIcon,
  ImageIcon,
  Spinner,
  TrashIcon,
} from "./icons";

export default function VisualBibleView({
  bible,
  styleId,
  projectId,
  images,
  imageVersion,
  refDoneIds,
  onGenerateImage,
  onDeleteImage,
  onToggleRef,
  onBuildBible,
}: {
  bible: VisualBible;
  styleId: string;
  projectId: string;
  images: Set<string>;
  imageVersion: number;
  refDoneIds: string[];
  onGenerateImage: (
    scope: ImageScope,
    key: string,
    prompt: string,
    referenceKeys?: string[],
  ) => Promise<void>;
  onDeleteImage: (scope: ImageScope, key: string) => Promise<void>;
  onToggleRef: (id: string, done: boolean) => void;
  /** Build a bible from the script (pasted-script projects with an empty bible). */
  onBuildBible?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; msg: string } | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildErr, setBuildErr] = useState<string | null>(null);

  const entities = [...bible.characters, ...bible.locations];
  const count = entities.length;

  // Empty bible (e.g. a pasted script). Offer to build one from the script;
  // otherwise stay hidden (the bible is grown by scene cutting regardless).
  if (count === 0) {
    if (!onBuildBible) return null;
    async function build() {
      setBuilding(true);
      setBuildErr(null);
      try {
        await onBuildBible!();
      } catch (e) {
        setBuildErr(e instanceof Error ? e.message : "Couldn't build the bible.");
      } finally {
        setBuilding(false);
      }
    }
    return (
      <section className="surface p-5">
        <p className="eyebrow flex items-center gap-2">
          <ImageIcon width={14} height={14} /> Visual bible
        </p>
        <p className="mt-1 text-xs text-faint">
          No recurring characters or objects yet. Build a visual bible from your
          script so people and key objects stay consistent across every shot.
          (Cutting scenes also grows it.)
        </p>
        {buildErr && <p className="mt-2 text-xs text-ember-300">{buildErr}</p>}
        <button
          type="button"
          onClick={build}
          disabled={building}
          className="btn btn-ember mt-3 !text-xs"
        >
          {building ? (
            <>
              <Spinner width={14} height={14} /> Building…
            </>
          ) : (
            "Build visual bible"
          )}
        </button>
      </section>
    );
  }

  const done = entities.filter(
    (e) => images.has(`ref:${e.id}`) || refDoneIds.includes(e.id),
  ).length;

  async function gen(id: string, prompt: string) {
    setBusyId(id);
    setError(null);
    try {
      await onGenerateImage("ref", id, prompt);
    } catch (e) {
      setError({ id, msg: e instanceof Error ? e.message : "Generation failed." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="eyebrow">Visual bible</span>
          <span className="mt-0.5 block text-xs text-faint">
            {bible.characters.length} characters · {bible.locations.length}{" "}
            locations — kept consistent across every frame · {done}/{count}{" "}
            generated
          </span>
        </span>
        <ChevronDownIcon
          width={18}
          height={18}
          className={`shrink-0 text-faint transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-[var(--line)] px-5 py-5">
          <p className="mb-4 text-xs text-faint">
            Generate each reference once with Nano Banana — it&rsquo;s then reused
            in every scene that entity appears in, which is what keeps people and
            objects identical across separately generated frames. Or copy the
            prompt to your own tool and tick it done.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <BibleColumn
              title="Characters"
              items={bible.characters}
              kind="character"
              styleId={styleId}
              projectId={projectId}
              images={images}
              imageVersion={imageVersion}
              refDoneIds={refDoneIds}
              busyId={busyId}
              error={error}
              onGen={gen}
              onDeleteImage={onDeleteImage}
              onToggleRef={onToggleRef}
            />
            <BibleColumn
              title="Locations & objects"
              items={bible.locations}
              kind="location"
              styleId={styleId}
              projectId={projectId}
              images={images}
              imageVersion={imageVersion}
              refDoneIds={refDoneIds}
              busyId={busyId}
              error={error}
              onGen={gen}
              onDeleteImage={onDeleteImage}
              onToggleRef={onToggleRef}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function BibleColumn({
  title,
  items,
  kind,
  styleId,
  projectId,
  images,
  imageVersion,
  refDoneIds,
  busyId,
  error,
  onGen,
  onDeleteImage,
  onToggleRef,
}: {
  title: string;
  items: { id: string; name: string; visualDescription: string }[];
  kind: "character" | "location";
  styleId: string;
  projectId: string;
  images: Set<string>;
  imageVersion: number;
  refDoneIds: string[];
  busyId: string | null;
  error: { id: string; msg: string } | null;
  onGen: (id: string, prompt: string) => void;
  onDeleteImage: (scope: ImageScope, key: string) => Promise<void>;
  onToggleRef: (id: string, done: boolean) => void;
}) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-twilight-300">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-faint">None</p>
      ) : (
        <ul className="space-y-4">
          {items.map((it) => {
            const hasImg = images.has(`ref:${it.id}`);
            const manual = refDoneIds.includes(it.id);
            const isDone = hasImg || manual;
            const busy = busyId === it.id;
            const prompt = composeReferencePrompt(it, styleId, kind);
            return (
              <li key={it.id} className="flex gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--line)] bg-ink-950/50">
                  {hasImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(projectId, "ref", it.id, imageVersion)}
                      alt={it.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-faint">
                      <ImageIcon width={16} height={16} />
                    </span>
                  )}
                  {isDone && (
                    <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl-md bg-mint-400/90 text-ink-950">
                      <CheckIcon width={10} height={10} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-cream">
                      {it.name}
                    </span>
                    <span className="font-mono text-[0.62rem] text-faint">
                      {it.id}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {it.visualDescription}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <CopyButton text={prompt} label="Prompt" />
                    <button
                      type="button"
                      onClick={() => onGen(it.id, prompt)}
                      disabled={busy}
                      className="btn btn-ember !px-3 !py-1.5 !text-xs"
                    >
                      {busy ? (
                        <>
                          <Spinner width={13} height={13} /> Generating…
                        </>
                      ) : hasImg ? (
                        "Regenerate"
                      ) : (
                        "Generate"
                      )}
                    </button>
                    {hasImg ? (
                      <button
                        type="button"
                        onClick={() => onDeleteImage("ref", it.id)}
                        aria-label="Remove image"
                        className="btn btn-ghost !px-2 !py-1.5 !text-xs"
                      >
                        <TrashIcon width={14} height={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggleRef(it.id, !manual)}
                        title="Mark done (if you generated it elsewhere)"
                        className={`btn btn-ghost !px-2 !py-1.5 !text-xs ${manual ? "text-mint-400" : ""}`}
                      >
                        <CheckIcon width={14} height={14} />
                      </button>
                    )}
                  </div>
                  {error?.id === it.id && (
                    <p className="mt-1 text-xs text-ember-300">{error.msg}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
