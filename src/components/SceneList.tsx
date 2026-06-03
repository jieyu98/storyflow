"use client";

import type { Coverage } from "@/lib/scenes";
import type { BibleCharacter, Scene } from "@/lib/types";
import { composeImagePrompt } from "@/lib/styles";
import { formatClock } from "@/lib/text";
import SceneCard from "./SceneCard";
import CopyButton from "./CopyButton";

export default function SceneList({
  scenes,
  styleId,
  characters,
  coverage,
  projectId,
  clips,
  clipVersion,
  onClipChange,
}: {
  scenes: Scene[];
  styleId: string;
  characters: BibleCharacter[];
  coverage: Coverage;
  projectId: string;
  clips: Set<number>;
  clipVersion: number;
  onClipChange: (index: number, hasClip: boolean) => void;
}) {
  if (scenes.length === 0) return null;

  const allHavePrompts = scenes.every((s) => s.imagePrompt);
  const allText = scenes
    .map(
      (s) =>
        `SCENE ${s.index + 1} — ${s.assignedDuration}s (${formatClock(
          s.tStart,
        )}–${formatClock(s.tSpokenEnd)})\nNARRATION: ${s.text}\nIMAGE: ${composeImagePrompt(
          s.imagePrompt,
          styleId,
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
        Tip: generate your first clean frame of a character, then reuse it as a
        reference image in later shots to keep them looking the same.
      </p>

      {scenes.map((s) => (
        <SceneCard
          key={`${s.startWord}:${s.endWord}`}
          scene={s}
          styleId={styleId}
          characters={characters}
          projectId={projectId}
          hasClip={clips.has(s.index)}
          clipVersion={clipVersion}
          onClipChange={onClipChange}
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
