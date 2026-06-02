"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { wordsFromAlignment, audioDurationFromWords } from "@/lib/alignment";
import { cutScenes, sceneCoverage } from "@/lib/scenes";
import {
  base64ToMp3Blob,
  getAudio,
  getProject,
  saveAudio,
  upsertProject,
} from "@/lib/storage";
import { formatClock } from "@/lib/text";
import {
  ALL_DURATIONS,
  type Duration,
  type Project,
  type Scene,
  type TtsModelId,
} from "@/lib/types";
import ScriptCard from "./ScriptCard";
import VisualBibleView from "./VisualBibleView";
import VoicePicker from "./VoicePicker";
import VoiceoverPlayer from "./VoiceoverPlayer";
import DurationSelector from "./DurationSelector";
import SceneList from "./SceneList";
import { ArrowIcon, FilmIcon, MicIcon, SparkIcon, Spinner } from "./icons";

type PromptEntry = {
  imagePrompt: string;
  animationPrompt: string;
  characterIds?: string[];
};

const sceneKey = (s: { startWord: number; endWord: number }) =>
  `${s.startWord}:${s.endWord}`;

export default function Studio({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const projectRef = useRef<Project | null>(null);

  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState<string | undefined>();
  const [voiceName, setVoiceName] = useState<string | undefined>();
  const [model, setModel] = useState<TtsModelId>("eleven_multilingual_v2");
  const [allowed, setAllowed] = useState<Duration[]>([...ALL_DURATIONS]);
  const [promptMap, setPromptMap] = useState<Record<string, PromptEntry>>({});
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const [regenerating, setRegenerating] = useState(false);
  const [voicing, setVoicing] = useState(false);
  const [cutting, setCutting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------ load project ----------------------------- */
  useEffect(() => {
    const p = getProject(projectId);
    if (!p) {
      setProject(null);
      return;
    }
    projectRef.current = p;
    setProject(p);
    setTitle(p.title);
    setScript(p.script);
    setVoiceId(p.voiceId);
    setVoiceName(p.voiceName);
    setModel((p.modelId as TtsModelId) ?? "eleven_multilingual_v2");
    setAllowed(
      p.allowedDurations?.length ? p.allowedDurations : [...ALL_DURATIONS],
    );
    if (p.scenes?.length) {
      const m: Record<string, PromptEntry> = {};
      for (const s of p.scenes) {
        if (s.imagePrompt) {
          m[sceneKey(s)] = {
            imagePrompt: s.imagePrompt,
            animationPrompt: s.animationPrompt ?? "",
            characterIds: s.characterIds,
          };
        }
      }
      setPromptMap(m);
    }
    if (p.hasAudio) {
      void getAudio(projectId).then((blob) => {
        if (blob) setAudioUrlSafe(URL.createObjectURL(blob));
      });
    }
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function setAudioUrlSafe(url: string | null) {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    setAudioUrl(url);
  }

  function save(mutate: (p: Project) => Project) {
    const cur = projectRef.current;
    if (!cur) return;
    const next = { ...mutate(cur), updatedAt: Date.now() };
    projectRef.current = next;
    upsertProject(next);
    setProject(next);
  }

  /* ------------------------------ derived state ---------------------------- */
  const words = useMemo(
    () => (project?.alignment ? wordsFromAlignment(project.alignment) : []),
    [project?.alignment],
  );

  const baseScenes = useMemo(
    () => (words.length ? cutScenes(words, allowed) : []),
    [words, allowed],
  );

  const scenes: Scene[] = useMemo(
    () =>
      baseScenes.map((s) => {
        const p = promptMap[sceneKey(s)];
        return p ? { ...s, ...p } : s;
      }),
    [baseScenes, promptMap],
  );

  const coverage = useMemo(() => sceneCoverage(baseScenes), [baseScenes]);
  const somePrompts = scenes.some((s) => s.imagePrompt);
  const scriptDirty =
    project?.voicedScript != null && project.voicedScript !== script;

  /* -------------------------------- handlers ------------------------------- */
  function handleScriptChange(value: string) {
    setScript(value);
    save((p) => ({ ...p, script: value }));
  }

  function handleTitleBlur() {
    const t = title.trim() || "Untitled story";
    setTitle(t);
    save((p) => ({ ...p, title: t }));
  }

  async function handleRegenerateScript() {
    if (!project) return;
    setError(null);
    setRegenerating(true);
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          redditText: project.redditText,
          scriptStyleId: project.scriptStyleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not rewrite.");
      setScript(data.script);
      save((p) => ({
        ...p,
        script: data.script,
        coreTurn: data.coreTurn || undefined,
        visualBible: data.visualBible ?? p.visualBible,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rewrite.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleVoiceover() {
    if (!voiceId || !script.trim()) return;
    setError(null);
    setVoicing(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: script, voiceId, modelId: model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Voiceover failed.");

      const blob = base64ToMp3Blob(data.audioBase64);
      await saveAudio(projectId, blob);
      setAudioUrlSafe(URL.createObjectURL(blob));

      const w = wordsFromAlignment(data.alignment);
      const duration = audioDurationFromWords(w);
      setPromptMap({}); // timings changed → drop stale prompts
      save((p) => ({
        ...p,
        script,
        alignment: data.alignment,
        voicedScript: script,
        audioDuration: duration,
        voiceId,
        voiceName,
        modelId: model,
        hasAudio: true,
        scenes: [],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Voiceover failed.");
    } finally {
      setVoicing(false);
    }
  }

  function handleAllowed(next: Duration[]) {
    setAllowed(next);
    const base = words.length ? cutScenes(words, next) : [];
    const merged = base.map((s) => {
      const p = promptMap[sceneKey(s)];
      return p ? { ...s, ...p } : s;
    });
    save((p) => ({ ...p, allowedDurations: next, scenes: merged }));
  }

  async function handlePrompts() {
    if (!project || baseScenes.length === 0) return;
    setError(null);
    setCutting(true);
    try {
      const payload = baseScenes.map((s) => ({
        index: s.index,
        text: s.text,
        assignedDuration: s.assignedDuration,
      }));
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenes: payload,
          visualBible: project.visualBible,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not write prompts.");

      const map: Record<string, PromptEntry> = { ...promptMap };
      for (const sp of data.scenes ?? []) {
        const s = baseScenes[sp.index];
        if (s) {
          map[sceneKey(s)] = {
            imagePrompt: sp.imagePrompt,
            animationPrompt: sp.animationPrompt,
            characterIds: sp.characterIds,
          };
        }
      }
      setPromptMap(map);
      const merged = baseScenes.map((s) => {
        const p = map[sceneKey(s)];
        return p ? { ...s, ...p } : s;
      });
      save((p) => ({ ...p, allowedDurations: allowed, scenes: merged }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not write prompts.");
    } finally {
      setCutting(false);
    }
  }

  /* --------------------------------- render -------------------------------- */
  if (project === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-faint">
        <Spinner width={22} height={22} />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-2xl">Story not found</p>
        <p className="text-sm text-muted">
          This draft isn&rsquo;t in this browser&rsquo;s storage.
        </p>
        <Link href="/" className="btn btn-ember">
          <ArrowIcon width={16} height={16} className="rotate-180" /> Back to
          start
        </Link>
      </div>
    );
  }

  const hasAudio = Boolean(project.hasAudio);

  return (
    <div className="relative z-[1] mx-auto max-w-5xl px-5 pb-28 pt-6">
      {/* top bar */}
      <header className="flex items-center gap-3">
        <Link
          href="/"
          className="btn btn-ghost !px-2.5 !py-2"
          aria-label="Back"
        >
          <ArrowIcon width={16} height={16} className="rotate-180" />
        </Link>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-ember-400 to-ember-600 text-[#25150a]">
          <SparkIcon width={16} height={16} />
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="min-w-0 flex-1 truncate rounded-lg bg-transparent font-display text-lg font-semibold text-cream outline-none focus:bg-white/5 focus:px-2"
          aria-label="Story title"
        />
      </header>

      {error && (
        <p className="mt-4 rounded-xl border border-ember-600/40 bg-ember-600/10 px-4 py-2.5 text-sm text-ember-300">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-4">
        <ScriptCard
          script={script}
          onChange={handleScriptChange}
          onRegenerate={handleRegenerateScript}
          regenerating={regenerating}
          audioDuration={project.audioDuration}
          dirty={scriptDirty}
          coreTurn={project.coreTurn}
        />

        <VisualBibleView bible={project.visualBible} />

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Voiceover */}
          <section className="surface space-y-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow flex items-center gap-2">
                <MicIcon width={14} height={14} /> Voiceover
              </p>
              {voiceName && <span className="chip">{voiceName}</span>}
            </div>

            <VoicePicker
              voiceId={voiceId}
              onVoiceChange={(id, name) => {
                setVoiceId(id);
                setVoiceName(name);
              }}
              model={model}
              onModelChange={setModel}
            />

            <button
              type="button"
              onClick={handleVoiceover}
              disabled={voicing || !voiceId || !script.trim()}
              className="btn btn-ember w-full"
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

            {audioUrl && (
              <VoiceoverPlayer
                src={audioUrl}
                duration={project.audioDuration}
                scenes={baseScenes}
                title={project.title}
              />
            )}
            {scriptDirty && audioUrl && (
              <p className="text-xs text-ember-300/90">
                Script changed since this voiceover — regenerate to re-sync
                timestamps.
              </p>
            )}
          </section>

          {/* Scene timing */}
          <section className="surface space-y-4 p-5">
            <p className="eyebrow flex items-center gap-2">
              <FilmIcon width={14} height={14} /> Scene timing
            </p>

            <div>
              <p className="mb-2 text-xs text-faint">Allowed clip lengths</p>
              <DurationSelector allowed={allowed} onChange={handleAllowed} />
            </div>

            {!hasAudio ? (
              <p className="text-xs text-faint">
                Generate a voiceover first — scenes are cut from its word
                timestamps.
              </p>
            ) : (
              <p className="text-xs text-faint">
                {baseScenes.length} scenes from{" "}
                {formatClock(coverage.totalSpoken)} of speech.
              </p>
            )}

            <button
              type="button"
              onClick={handlePrompts}
              disabled={cutting || baseScenes.length === 0}
              className="btn btn-ember w-full"
            >
              {cutting ? (
                <>
                  <Spinner width={16} height={16} /> Writing scene prompts…
                </>
              ) : somePrompts ? (
                "Rewrite scene prompts"
              ) : (
                "Write scene prompts"
              )}
            </button>
          </section>
        </div>

        {scenes.length > 0 && (
          <SceneList
            scenes={scenes}
            styleId={project.stylePresetId}
            characters={project.visualBible.characters}
            coverage={coverage}
          />
        )}
      </div>
    </div>
  );
}
