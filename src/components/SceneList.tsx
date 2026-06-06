"use client";

import type { Coverage } from "@/lib/scenes";
import type { BibleCharacter, BibleLocation, Scene } from "@/lib/types";
import { composeImagePrompt, styleForScene } from "@/lib/styles";
import { buildSceneRecipes } from "@/lib/recipe";
import type { ImageScope } from "@/lib/storage";
import { formatClock } from "@/lib/text";
import SceneCard from "./SceneCard";
import CopyButton from "./CopyButton";

export default function SceneList({
  scenes,
  styleId,
  conceptStyleId,
  characters,
  locations,
  coverage,
  projectId,
  clips,
  clipVersion,
  onClipChange,
  onPreview,
  images,
  imageVersion,
  onGenerateImage,
  onUploadImage,
  onDeleteImage,
  onGenerateClip,
  approved,
  onApproveChange,
}: {
  scenes: Scene[];
  styleId: string;
  conceptStyleId?: string;
  characters: BibleCharacter[];
  locations: BibleLocation[];
  coverage: Coverage;
  projectId: string;
  clips: Set<number>;
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
  onUploadImage?: (
    scope: ImageScope,
    key: string,
    file: File,
  ) => Promise<void>;
  onDeleteImage?: (scope: ImageScope, key: string) => Promise<void>;
  onGenerateClip?: (
    sceneIndex: number,
    prompt: string,
    duration?: number,
    aspectRatio?: string,
  ) => Promise<void>;
  approved?: Set<number>;
  onApproveChange?: (index: number, approved: boolean) => void;
}) {
  if (scenes.length === 0) return null;

  const recipes = buildSceneRecipes(scenes, { characters, locations });
  const allHavePrompts = scenes.every((s) => s.imagePrompt);
  const allText = scenes
    .map(
      (s, i) =>
        `SCENE ${s.index + 1} — ${s.assignedDuration}s (${formatClock(
          s.tStart,
        )}–${formatClock(s.tSpokenEnd)})\nHOW: ${recipes[i].method} — ${recipes[i].steps.join(
          " ",
        )}\nNARRATION: ${s.text}\nIMAGE: ${composeImagePrompt(
          s.imagePrompt,
          styleForScene(s, styleId, conceptStyleId),
        )}\nANIMATION: ${s.animationPrompt ?? ""}`,
    )
    .join("\n\n———————\n\n");

  return (
    <div className="space-y-3">
      <div className="surface flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 text-xs text-muted">
        <Stat label="scenes" value={String(scenes.length)} />
        <Stat label="video total" value={`${coverage.totalClip}s`} />
        <Stat label="voiceover" value={formatClock(coverage.totalSpoken)} />
        <Stat
          label="round-up"
          value={`+${coverage.padding.toFixed(1)}s`}
          warn={coverage.padding > 3}
        />
        {allHavePrompts && (
          <CopyButton text={allText} label="Copy all" className="ml-auto" />
        )}
      </div>

      <p className="px-1 text-xs text-faint">
        Tip: generate the reference images in the Visual bible first, then attach
        each as a reference in the scenes that list it. For graphic scenes, reuse
        your first diagram as a style reference so they all match.
      </p>

      {scenes.map((s, i) => (
        <SceneCard
          key={`${s.startWord}:${s.endWord}`}
          scene={s}
          styleId={styleForScene(s, styleId, conceptStyleId)}
          recipe={recipes[i]}
          projectId={projectId}
          hasClip={clips.has(s.index)}
          clipVersion={clipVersion}
          onClipChange={onClipChange}
          onPreview={onPreview}
          images={images}
          imageVersion={imageVersion}
          onGenerateImage={onGenerateImage}
          onUploadImage={onUploadImage}
          onDeleteImage={onDeleteImage}
          onGenerateClip={onGenerateClip}
          approved={approved?.has(s.index) ?? false}
          onApproveChange={onApproveChange}
        />
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={`font-mono text-sm font-bold ${warn ? "text-ember-400" : "text-cream"}`}
      >
        {value}
      </span>
      <span className="text-faint">{label}</span>
    </span>
  );
}
