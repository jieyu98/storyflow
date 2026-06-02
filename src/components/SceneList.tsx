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
}: {
  scenes: Scene[];
  styleId: string;
  characters: BibleCharacter[];
  coverage: Coverage;
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

      {scenes.map((s) => (
        <SceneCard
          key={`${s.startWord}:${s.endWord}`}
          scene={s}
          styleId={styleId}
          characters={characters}
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
