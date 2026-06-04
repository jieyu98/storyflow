"use client";

import type { ReactNode } from "react";
import type { Scene } from "@/lib/types";
import type { SceneRecipe } from "@/lib/recipe";
import { composeImagePrompt } from "@/lib/styles";
import { formatClock } from "@/lib/text";
import CopyButton from "./CopyButton";
import ClipDrop from "./ClipDrop";
import { ImageIcon, MotionIcon, PlayIcon } from "./icons";

export default function SceneCard({
  scene,
  styleId,
  recipe,
  projectId,
  hasClip,
  clipVersion,
  onClipChange,
  onPreview,
}: {
  scene: Scene;
  styleId: string;
  recipe: SceneRecipe;
  projectId: string;
  hasClip: boolean;
  clipVersion: number;
  onClipChange: (index: number, hasClip: boolean) => void;
  onPreview: (scene: Scene) => void;
}) {
  const hasPrompts = Boolean(scene.imagePrompt);
  const composedImage = composeImagePrompt(scene.imagePrompt, styleId);

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
            <PromptBlock
              icon={<ImageIcon width={14} height={14} />}
              label="Image prompt — starting frame"
              text={composedImage}
              accent="ember"
            />
            <PromptBlock
              icon={<MotionIcon width={14} height={14} />}
              label="Animation prompt"
              text={scene.animationPrompt ?? ""}
              accent="twilight"
            />
            {scene.onScreenText && (
              <div className="rounded-xl border border-[var(--line)] bg-ink-950/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-mint-400">
                    On-screen text — overlay in your editor
                  </span>
                  <CopyButton text={scene.onScreenText} />
                </div>
                <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted">
                  {scene.onScreenText}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs text-faint">
            Prompts not written yet — hit “Write scene prompts”.
          </p>
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
