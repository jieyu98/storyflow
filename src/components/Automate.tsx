// A compact progress readout for the production pipeline, shown right after the
// script. It does NOT duplicate the actions below — each stage is performed in
// its own section (Voiceover, Scenes, Visual bible, Scene list). This is just an
// at-a-glance "where am I" bar across the four stages.

import type { Scene, VisualBible } from "@/lib/types";
import { CheckIcon, SparkIcon } from "./icons";

export default function Automate({
  hasAudio,
  scriptDirty,
  scenes,
  clips,
  bible,
  images,
  refDoneIds,
}: {
  hasAudio: boolean;
  scriptDirty: boolean;
  scenes: Scene[];
  clips: Set<number>;
  bible: VisualBible;
  images: Set<string>;
  refDoneIds: string[];
}) {
  const refEntities = [...bible.characters, ...bible.locations];
  const refsTotal = refEntities.length;
  const refsDone = refEntities.filter(
    (e) => images.has(`ref:${e.id}`) || refDoneIds.includes(e.id),
  ).length;

  const clipsTotal = scenes.length;
  const clipsDone = scenes.filter((s) => clips.has(s.index)).length;

  const voiceDone = hasAudio && !scriptDirty;
  const scenesDone = scenes.length > 0;

  const completed =
    (voiceDone ? 1 : 0) + (scenesDone ? 1 : 0) + refsDone + clipsDone;
  const total = 2 + refsTotal + clipsTotal;

  return (
    <section className="surface p-5">
      <div className="flex items-center gap-2">
        <p className="eyebrow flex items-center gap-2">
          <SparkIcon width={14} height={14} /> Automate
        </p>
        <span className="ml-auto font-mono text-xs text-faint">
          {completed}/{total} done
        </span>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-ember-500 to-ember-400 transition-[width]"
          style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <Stage label="Voiceover">
          {voiceDone ? (
            <Done />
          ) : scriptDirty ? (
            <span className="text-ember-300">re-sync</span>
          ) : (
            <Todo />
          )}
        </Stage>
        <Stage label="Scenes">
          {scenesDone ? (
            <span className="font-mono text-mint-400">{scenes.length}</span>
          ) : (
            <Todo />
          )}
        </Stage>
        {refsTotal > 0 && (
          <Stage label="References">
            <Count done={refsDone} total={refsTotal} />
          </Stage>
        )}
        {clipsTotal > 0 && (
          <Stage label="Clips">
            <Count done={clipsDone} total={clipsTotal} />
          </Stage>
        )}
      </div>
    </section>
  );
}

function Stage({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-faint">{label}</span>
      {children}
    </span>
  );
}

function Count({ done, total }: { done: number; total: number }) {
  return (
    <span className={`font-mono ${done >= total ? "text-mint-400" : "text-cream"}`}>
      {done}/{total}
    </span>
  );
}

function Done() {
  return (
    <span className="text-mint-400">
      <CheckIcon width={13} height={13} />
    </span>
  );
}

function Todo() {
  return <span className="text-faint">—</span>;
}
