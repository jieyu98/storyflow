"use client";

import type { ReactNode } from "react";
import type { BibleCharacter, Scene } from "@/lib/types";
import { composeImagePrompt } from "@/lib/styles";
import { formatClock } from "@/lib/text";
import CopyButton from "./CopyButton";
import ClipDrop from "./ClipDrop";
import { ImageIcon, MotionIcon } from "./icons";

export default function SceneCard({
  scene,
  styleId,
  characters,
  projectId,
  hasClip,
  clipVersion,
  onClipChange,
}: {
  scene: Scene;
  styleId: string;
  characters: BibleCharacter[];
  projectId: string;
  hasClip: boolean;
  clipVersion: number;
  onClipChange: (index: number, hasClip: boolean) => void;
}) {
  const nameById = (id: string) =>
    characters.find((c) => c.id === id)?.name ?? id;
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
              over {scene.assignedDuration}s — needs a longer max
            </span>
          )}
          {scene.characterIds?.map((id) => (
            <span key={id} className="chip text-twilight-300">
              {nameById(id)}
            </span>
          ))}
        </div>

        {scene.name && (
          <h4 className="mt-2 font-display text-base font-semibold text-cream">
            {scene.name}
          </h4>
        )}

        <p className="mt-1.5 text-sm leading-relaxed text-cream/90">
          {scene.text}
        </p>

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
