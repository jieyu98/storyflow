"use client";

import { type ReactNode, useState } from "react";
import type { Scene } from "@/lib/types";
import type { SceneRecipe } from "@/lib/recipe";
import { composeImagePrompt } from "@/lib/styles";
import { imageUrl, type ImageScope } from "@/lib/storage";
import { formatClock } from "@/lib/text";
import CopyButton from "./CopyButton";
import ClipDrop from "./ClipDrop";
import { ImageIcon, MotionIcon, PlayIcon, Spinner, TrashIcon } from "./icons";

export default function SceneCard({
  scene,
  styleId,
  recipe,
  projectId,
  hasClip,
  clipVersion,
  onClipChange,
  onPreview,
  images,
  imageVersion = 0,
  onGenerateImage,
  onDeleteImage,
  onGenerateClip,
}: {
  scene: Scene;
  styleId: string;
  recipe: SceneRecipe;
  projectId: string;
  hasClip: boolean;
  clipVersion: number;
  onClipChange: (index: number, hasClip: boolean) => void;
  onPreview: (scene: Scene) => void;
  images?: Set<string>;
  imageVersion?: number;
  onGenerateImage?: (
    scope: ImageScope,
    key: string,
    prompt: string,
    referenceKeys?: string[],
  ) => Promise<void>;
  onDeleteImage?: (scope: ImageScope, key: string) => Promise<void>;
  onGenerateClip?: (
    sceneIndex: number,
    prompt: string,
    duration?: number,
    aspectRatio?: string,
  ) => Promise<void>;
}) {
  const hasPrompts = Boolean(scene.imagePrompt);
  const composedImage = composeImagePrompt(scene.imagePrompt, styleId);

  const imgKey = String(scene.index);
  const hasImage = images?.has(`scene:${scene.index}`) ?? false;
  const canGenerate = Boolean(onGenerateImage && hasPrompts);
  const refKeys = [
    ...(scene.characterIds ?? []),
    ...(scene.locationIds ?? []),
  ];
  const [busyImg, setBusyImg] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);

  async function generate() {
    if (!onGenerateImage) return;
    setBusyImg(true);
    setImgErr(null);
    try {
      await onGenerateImage("scene", imgKey, composedImage, refKeys);
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusyImg(false);
    }
  }

  const [busyClip, setBusyClip] = useState(false);
  const [clipErr, setClipErr] = useState<string | null>(null);

  async function generateClip() {
    if (!onGenerateClip) return;
    setBusyClip(true);
    setClipErr(null);
    try {
      await onGenerateClip(
        scene.index,
        scene.animationPrompt ?? composedImage,
        scene.assignedDuration,
        "9:16",
      );
    } catch (e) {
      setClipErr(e instanceof Error ? e.message : "Clip generation failed.");
    } finally {
      setBusyClip(false);
    }
  }

  return (
    <article className="surface flex overflow-hidden">
      <div className="sprockets flex w-14 shrink-0 flex-col items-center justify-between border-r border-[var(--line)] bg-ink-950/40 py-4">
        <span className="font-mono text-xs text-faint">
          {String(scene.index + 1).padStart(2, "0")}
        </span>
        <span className="rounded-md bg-ember-500/15 px-2 py-1 font-mono text-sm font-bold text-ember-300">
          {scene.assignedDuration}s
        </span>
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-[0.68rem] text-faint">
          <span className="font-mono">
            {formatClock(scene.tStart)} → {formatClock(scene.tSpokenEnd)}
          </span>
          <span className="chip">{formatClock(scene.span)} on screen</span>
          {scene.clamped && (
            <span className="chip text-ember-300">
              over {scene.assignedDuration}s — split or extend
            </span>
          )}
          {scene.visualMode === "concept" && (
            <span className="chip text-twilight-300">graphic</span>
          )}
          {scene.shotType && <span className="chip">{scene.shotType}</span>}
          <button
            type="button"
            onClick={() => onPreview(scene)}
            className="btn btn-ghost ml-auto !px-2.5 !py-1 !text-[0.65rem]"
            title="Play this scene in the preview"
          >
            <PlayIcon width={11} height={11} /> Preview
          </button>
        </div>

        {scene.name && (
          <h4 className="mt-2 font-display text-base font-semibold text-cream">
            {scene.name}
          </h4>
        )}

        <p className="mt-1.5 text-sm leading-relaxed text-cream/90">
          {scene.text}
        </p>

        <div className="mt-3 rounded-xl border border-twilight-500/25 bg-twilight-500/5 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-twilight-300">
              Make this scene
            </span>
            <span className="chip text-twilight-300">{recipe.method}</span>
          </div>
          <ol className="space-y-1 text-xs leading-relaxed text-muted">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-twilight-300">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {hasPrompts ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-ink-950/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ember-300">
                  <ImageIcon width={14} height={14} />
                  Image prompt — starting frame
                </span>
                <div className="flex items-center gap-2">
                  {canGenerate && (
                    <button
                      type="button"
                      onClick={generate}
                      disabled={busyImg}
                      className="btn btn-ember !px-3 !py-1.5 !text-xs"
                    >
                      {busyImg ? (
                        <>
                          <Spinner width={13} height={13} /> Generating…
                        </>
                      ) : hasImage ? (
                        "Regenerate"
                      ) : (
                        "Generate"
                      )}
                    </button>
                  )}
                  <CopyButton text={composedImage} />
                </div>
              </div>
              {hasImage && (
                <div className="mb-2 flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(projectId, "scene", imgKey, imageVersion)}
                    alt={scene.name ?? `Scene ${scene.index + 1}`}
                    className="aspect-[9/16] w-20 shrink-0 rounded-md border border-[var(--line)] object-cover"
                  />
                  {onDeleteImage && (
                    <button
                      type="button"
                      onClick={() => onDeleteImage("scene", imgKey)}
                      className="btn btn-ghost !px-2 !py-1 !text-xs"
                    >
                      <TrashIcon width={13} height={13} /> Remove
                    </button>
                  )}
                </div>
              )}
              {imgErr && (
                <p className="mb-2 text-xs text-ember-300">{imgErr}</p>
              )}
              {canGenerate && refKeys.length > 0 && (
                <p className="mb-2 text-[0.68rem] text-faint">
                  Uses {refKeys.length} reference
                  {refKeys.length > 1 ? "s" : ""} for consistency (generate those
                  first).
                </p>
              )}
              <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted">
                {composedImage}
              </p>
            </div>
            <PromptBlock
              icon={<MotionIcon width={14} height={14} />}
              label="Animation prompt"
              text={scene.animationPrompt ?? ""}
              accent="twilight"
            />
          </div>
        ) : (
          <p className="mt-4 text-xs text-faint">
            Prompts not written yet — hit “Write scene prompts”.
          </p>
        )}

        {onGenerateClip && (
          <div className="mt-4 rounded-xl border border-mint-400/25 bg-mint-400/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-mint-400">
                <MotionIcon width={14} height={14} />
                Animate into a clip (Grok)
              </span>
              <button
                type="button"
                onClick={generateClip}
                disabled={busyClip || !hasImage}
                className="btn btn-ember !px-3 !py-1.5 !text-xs"
                title={
                  hasImage
                    ? "Image → video from the starting frame"
                    : "Generate the starting frame first"
                }
              >
                {busyClip ? (
                  <>
                    <Spinner width={13} height={13} /> Animating…
                  </>
                ) : hasClip ? (
                  "Regenerate clip"
                ) : (
                  "Generate clip"
                )}
              </button>
            </div>
            <p className="mt-1 text-[0.68rem] text-faint">
              {hasImage
                ? `Image → video from the starting frame, ${scene.assignedDuration}s, using the animation prompt. Takes ~20s+.`
                : "Generate the starting frame above first, then animate it here."}
            </p>
            {busyClip && (
              <p className="mt-1 text-[0.68rem] text-mint-400">
                Generating — keep this tab open; it can take a minute.
              </p>
            )}
            {clipErr && <p className="mt-1 text-xs text-ember-300">{clipErr}</p>}
          </div>
        )}

        <ClipDrop
          projectId={projectId}
          sceneIndex={scene.index}
          hasClip={hasClip}
          version={clipVersion}
          onChange={onClipChange}
        />
      </div>
    </article>
  );
}

function PromptBlock({
  icon,
  label,
  text,
  accent,
}: {
  icon: ReactNode;
  label: string;
  text: string;
  accent: "ember" | "twilight";
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-ink-950/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            accent === "ember" ? "text-ember-300" : "text-twilight-300"
          }`}
        >
          {icon}
          {label}
        </span>
        <CopyButton text={text} />
      </div>
      <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted">
        {text}
      </p>
    </div>
  );
}
