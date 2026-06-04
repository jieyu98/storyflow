"use client";

// The Automate stepper: a guided, ordered walk through the production pipeline,
// shown right after the script. Two kinds of step:
//   • "auto"  — the app performs it (voiceover via ElevenLabs, scenes via Claude).
//   • "you"   — a guided handoff: the app shows the exact prompts, you generate
//               the asset in your own tools and drop it back in. The app never
//               generates images/video (firm product boundary).
// Eventually the "you" steps can become "auto"; for now they're handoffs.

import { useEffect, useMemo, useState } from "react";
import { buildSceneRecipes } from "@/lib/recipe";
import { composeReferencePrompt, styleForScene } from "@/lib/styles";
import type { Scene, VisualBible } from "@/lib/types";
import CopyButton from "./CopyButton";
import SceneCard from "./SceneCard";
import {
  CheckIcon,
  ChevronDownIcon,
  FilmIcon,
  ImageIcon,
  SparkIcon,
  Spinner,
} from "./icons";

type StepKind = "auto" | "you";

export default function Automate({
  hasAudio,
  scriptDirty,
  scenes,
  clips,
  clipVersion,
  projectId,
  bible,
  styleId,
  conceptStyleId,
  voicing,
  canVoice,
  onGenerateVoiceover,
  cutting,
  canCutScenes,
  onGenerateScenes,
  onClipChange,
  onPreviewScene,
  refDoneIds,
  onToggleRef,
}: {
  hasAudio: boolean;
  scriptDirty: boolean;
  scenes: Scene[];
  clips: Set<number>;
  clipVersion: number;
  projectId: string;
  bible: VisualBible;
  styleId: string;
  conceptStyleId?: string;
  voicing: boolean;
  canVoice: boolean;
  onGenerateVoiceover: () => void;
  cutting: boolean;
  canCutScenes: boolean;
  onGenerateScenes: () => void;
  onClipChange: (index: number, hasClip: boolean) => void;
  onPreviewScene: (scene: Scene) => void;
  refDoneIds: string[];
  onToggleRef: (id: string, done: boolean) => void;
}) {
  const entities = useMemo(
    () => [
      ...bible.characters.map((c) => ({ ...c, kind: "character" as const })),
      ...bible.locations.map((l) => ({ ...l, kind: "location" as const })),
    ],
    [bible],
  );
  const refsDone =
    entities.length === 0 || entities.every((e) => refDoneIds.includes(e.id));

  const recipes = useMemo(
    () => buildSceneRecipes(scenes, bible),
    [scenes, bible],
  );

  type Step = {
    key: string;
    title: string;
    subtitle?: string;
    done: boolean;
    kind: StepKind;
    sceneIndex?: number;
  };

  const steps: Step[] = [
    {
      key: "voiceover",
      title: "Generate voiceover",
      done: hasAudio && !scriptDirty,
      kind: "auto",
    },
    {
      key: "scenes",
      title: "Generate scenes",
      done: scenes.length > 0,
      kind: "auto",
    },
    {
      key: "refs",
      title: "Generate reference images",
      subtitle:
        entities.length > 0 ? `${entities.length} to make` : undefined,
      done: refsDone,
      kind: "you",
    },
    ...scenes.map((s, i) => ({
      key: `scene-${s.index}`,
      title: `Generate scene ${i + 1}`,
      subtitle: s.name,
      done: clips.has(s.index),
      kind: "you" as const,
      sceneIndex: i,
    })),
  ];

  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  const activeIndex = steps.findIndex((s) => !s.done);
  const activeKey = activeIndex === -1 ? null : steps[activeIndex].key;

  const [openKey, setOpenKey] = useState<string | null>(activeKey);
  // Follow the pipeline forward: when the active step advances, open it.
  useEffect(() => {
    setOpenKey(activeKey);
  }, [activeKey]);

  function body(step: Step) {
    if (step.kind === "auto" && step.key === "voiceover") {
      if (hasAudio && !scriptDirty)
        return <p className="text-sm text-mint-400">Voiceover ready.</p>;
      return (
        <div>
          <p className="text-sm text-faint">
            ElevenLabs reads your script and returns word-level timing — the
            scenes are cut from it.
            {scriptDirty &&
              " Your script changed since the last voiceover — regenerate to re-sync."}
          </p>
          <button
            type="button"
            onClick={onGenerateVoiceover}
            disabled={voicing || !canVoice}
            className="btn btn-ember mt-3"
          >
            {voicing ? (
              <>
                <Spinner width={16} height={16} /> Generating voiceover…
              </>
            ) : hasAudio ? (
              "Regenerate voiceover"
            ) : (
              "Generate voiceover"
            )}
          </button>
          {!canVoice && (
            <p className="mt-2 text-xs text-faint">
              Pick a voice in the Voiceover section below first.
            </p>
          )}
        </div>
      );
    }

    if (step.kind === "auto" && step.key === "scenes") {
      if (scenes.length > 0)
        return (
          <p className="text-sm text-mint-400">
            {scenes.length} beats cut from the voiceover.
          </p>
        );
      return (
        <div>
          <p className="text-sm text-faint">
            Claude cuts the narration into visual beats and picks each
            shot&rsquo;s length, using the voiceover&rsquo;s timing.
          </p>
          <button
            type="button"
            onClick={onGenerateScenes}
            disabled={cutting || !canCutScenes}
            className="btn btn-ember mt-3"
          >
            {cutting ? (
              <>
                <Spinner width={16} height={16} /> Cutting scenes…
              </>
            ) : (
              "Generate scenes"
            )}
          </button>
          {!canCutScenes && (
            <p className="mt-2 text-xs text-faint">
              Generate a voiceover first.
            </p>
          )}
        </div>
      );
    }

    if (step.key === "refs") {
      if (entities.length === 0)
        return (
          <p className="text-sm text-faint">
            No characters or locations to reference — nothing to make here.
          </p>
        );
      return (
        <div>
          <p className="mb-3 text-sm text-faint">
            Generate each reference once in your image tool, then reuse it in
            every scene that entity appears in — that&rsquo;s what keeps them
            consistent. Tick each off as you go.
          </p>
          <ul className="space-y-2">
            {entities.map((e) => {
              const done = refDoneIds.includes(e.id);
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => onToggleRef(e.id, !done)}
                    aria-label={done ? "Mark not done" : "Mark generated"}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      done
                        ? "border-mint-400 bg-mint-400/20 text-mint-400"
                        : "border-[var(--line-strong)] text-transparent"
                    }`}
                  >
                    <CheckIcon width={12} height={12} />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm text-cream">
                    {e.name}
                    <span className="ml-2 chip">{e.kind}</span>
                  </span>
                  <CopyButton
                    text={composeReferencePrompt(e, styleId, e.kind)}
                    label="Copy prompt"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    // per-scene handoff — reuse the full scene card (prompts + recipe + clip drop)
    const i = step.sceneIndex!;
    const scene = scenes[i];
    return (
      <SceneCard
        scene={scene}
        styleId={styleForScene(scene, styleId, conceptStyleId)}
        recipe={recipes[i]}
        projectId={projectId}
        hasClip={clips.has(scene.index)}
        clipVersion={clipVersion}
        onClipChange={onClipChange}
        onPreview={onPreviewScene}
      />
    );
  }

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

      <p className="mt-3 text-xs text-faint">
        Guided pipeline. The app makes the{" "}
        <span className="text-cream">voiceover</span> and{" "}
        <span className="text-cream">scenes</span>; you generate the{" "}
        <span className="text-cream">images &amp; clips</span> in your own tools
        and drop them in.
      </p>

      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => {
          const open = openKey === step.key;
          const isActive = step.key === activeKey;
          return (
            <li
              key={step.key}
              className={`overflow-hidden rounded-xl border transition-colors ${
                isActive
                  ? "border-ember-500/40 bg-ember-500/5"
                  : "border-[var(--line)]"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : step.key)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs ${
                    step.done
                      ? "bg-mint-400/20 text-mint-400"
                      : isActive
                        ? "bg-ember-500/20 text-ember-300 ring-1 ring-ember-500/50"
                        : "bg-white/8 text-faint"
                  }`}
                >
                  {step.done ? <CheckIcon width={13} height={13} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`font-medium ${isActive ? "text-cream" : "text-cream/90"}`}
                  >
                    {step.title}
                  </span>
                  {step.subtitle && (
                    <span className="ml-2 truncate text-sm text-faint">
                      {step.subtitle}
                    </span>
                  )}
                </span>
                <span
                  className={`chip shrink-0 ${step.kind === "auto" ? "text-mint-400" : ""}`}
                  title={
                    step.kind === "auto"
                      ? "The app does this"
                      : "You generate this in your tools"
                  }
                >
                  {step.kind === "auto" ? (
                    <FilmIcon width={11} height={11} />
                  ) : (
                    <ImageIcon width={11} height={11} />
                  )}
                  {step.kind === "auto" ? "auto" : "you"}
                </span>
                <ChevronDownIcon
                  width={16}
                  height={16}
                  className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <div className="border-t border-[var(--line)] px-4 py-4">
                  {body(step)}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
