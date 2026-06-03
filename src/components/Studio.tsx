"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { wordsFromAlignment, audioDurationFromWords } from "@/lib/alignment";
import { sceneCoverage } from "@/lib/scenes";
import {
  audioUrl,
  base64ToBytes,
  getProject,
  saveAudio,
  upsertProject,
} from "@/lib/storage";
import { formatClock } from "@/lib/text";
import {
  DEFAULT_MAX_CLIP_SECONDS,
  type Project,
  type Scene,
  type TtsModelId,
} from "@/lib/types";
import ScriptCard from "./ScriptCard";
import VisualBibleView from "./VisualBibleView";
import VoicePicker from "./VoicePicker";
import VoiceoverPlayer from "./VoiceoverPlayer";
import SceneList from "./SceneList";
import { ArrowIcon, FilmIcon, MicIcon, SparkIcon, Spinner } from "./icons";

export default function Studio({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const projectRef = useRef<Project | null>(null);

  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState<string | undefined>();
  const [voiceName, setVoiceName] = useState<string | undefined>();
  const [model, setModel] = useState<TtsModelId>("eleven_multilingual_v2");
  const [maxClip, setMaxClip] = useState(DEFAULT_MAX_CLIP_SECONDS);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  const [regenerating, setRegenerating] = useState(false);
  const [voicing, setVoicing] = useState(false);
  const [cutting, setCutting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------ load project ----------------------------- */
  useEffect(() => {
    let cancelled = false;
    void getProject(projectId).then((p) => {
      if (cancelled) return;
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
      setMaxClip(p.maxClipSeconds ?? DEFAULT_MAX_CLIP_SECONDS);
      setScenes(p.scenes ?? []);
      if (p.hasAudio) setAudioSrc(audioUrl(projectId, p.updatedAt));
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function save(mutate: (p: Project) => Project) {
    const cur = projectRef.current;
    if (!cur) return;
    const next = { ...mutate(cur), updatedAt: Date.now() };
    projectRef.current = next;
    void upsertProject(next); // fire-and-forget persist
    setProject(next);
  }

  /* ------------------------------ derived state ---------------------------- */
  const words = useMemo(
    () => (project?.alignment ? wordsFromAlignment(project.alignment) : []),
    [project?.alignment],
  );
  const coverage = useMemo(() => sceneCoverage(scenes), [scenes]);
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

  function handleMaxClip(v: number) {
    const clamped = Math.max(3, Math.min(15, Math.round(v || DEFAULT_MAX_CLIP_SECONDS)));
    setMaxClip(clamped);
    save((p) => ({ ...p, maxClipSeconds: clamped }));
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

      const bytes = base64ToBytes(data.audioBase64);
      await saveAudio(projectId, bytes);

      const w = wordsFromAlignment(data.alignment);
      const duration = audioDurationFromWords(w);
      setScenes([]); // timings changed → previous cut is stale
      setAudioSrc(audioUrl(projectId, Date.now()));
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

  async function handleGenerateScenes() {
    if (!project || words.length === 0) return;
    setError(null);
    setCutting(true);
    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          words,
          visualBible: project.visualBible,
          maxSeconds: maxClip,
          title: project.title,
          coreTurn: project.coreTurn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cut scenes.");
      const next: Scene[] = data.scenes ?? [];
      setScenes(next);
      save((p) => ({ ...p, maxClipSeconds: maxClip, scenes: next }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cut scenes.");
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
        <Link href="/" className="btn btn-ghost !px-2.5 !py-2" aria-label="Back">
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

            {audioSrc && (
              <VoiceoverPlayer
                src={audioSrc}
                duration={project.audioDuration}
                scenes={scenes}
                title={project.title}
              />
            )}
            {scriptDirty && audioSrc && (
              <p className="text-xs text-ember-300/90">
                Script changed since this voiceover — regenerate to re-sync
                timestamps.
              </p>
            )}
          </section>

          {/* Scenes */}
          <section className="surface space-y-4 p-5">
            <p className="eyebrow flex items-center gap-2">
              <FilmIcon width={14} height={14} /> Scenes
            </p>

            <div className="flex items-center justify-between">
              <span className="text-xs text-faint">Max clip length</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMaxClip(maxClip - 1)}
                  className="btn btn-ghost !px-3 !py-1.5"
                  aria-label="Decrease max clip length"
                >
                  −
                </button>
                <span className="w-12 text-center font-mono text-sm text-cream">
                  {maxClip}s
                </span>
                <button
                  type="button"
                  onClick={() => handleMaxClip(maxClip + 1)}
                  className="btn btn-ghost !px-3 !py-1.5"
                  aria-label="Increase max clip length"
                >
                  +
                </button>
              </div>
            </div>

            {!hasAudio ? (
              <p className="text-xs text-faint">
                Generate a voiceover first — the AI reads its timestamps to cut
                beats.
              </p>
            ) : (
              <p className="text-xs text-faint">
                The AI cuts the narration into visual beats; clips tile the whole
                voiceover, each rounded up to a whole second for Kling.
                {scenes.length > 0 &&
                  ` ${scenes.length} beats · ${formatClock(coverage.totalSpoken)} voiceover.`}
              </p>
            )}

            <button
              type="button"
              onClick={handleGenerateScenes}
              disabled={cutting || words.length === 0}
              className="btn btn-ember w-full"
            >
              {cutting ? (
                <>
                  <Spinner width={16} height={16} /> Cutting scenes…
                </>
              ) : scenes.length > 0 ? (
                "Regenerate scenes"
              ) : (
                "Generate scenes"
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
