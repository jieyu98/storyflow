"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { wordsFromAlignment, audioDurationFromWords } from "@/lib/alignment";
import { sceneCoverage } from "@/lib/scenes";
import {
  audioUrl,
  base64ToBytes,
  cancelClipBatch,
  cancelImageBatch,
  deleteAllClips,
  deleteAllImages,
  deleteImage,
  generateBible,
  generateCaptionEmphasis,
  generateClip,
  generateImage,
  generateSocial,
  getClipBatch,
  getImageBatch,
  getProject,
  getUsage,
  listClips,
  listImages,
  saveAudio,
  uploadImage,
  upsertProject,
  type ImageScope,
  type UsageSummary,
} from "@/lib/storage";
import { formatClock, formatUsd } from "@/lib/text";
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_SCENE_MODEL_ID,
  DEFAULT_STORY_MODEL_ID,
  IMAGE_MODELS,
  SCENE_MODELS,
  type ClipBatch,
  type ImageBatch,
  type Project,
  type Scene,
  type SceneModelId,
  type StoryModelId,
  type TtsModelId,
} from "@/lib/types";
import ScriptCard from "./ScriptCard";
import SocialCard from "./SocialCard";
import ImageBatchPanel from "./ImageBatchPanel";
import VisualBibleView from "./VisualBibleView";
import VoicePicker from "./VoicePicker";
import VoiceoverPlayer from "./VoiceoverPlayer";
import SceneList from "./SceneList";
import ClipBatchPanel from "./ClipBatchPanel";
import PreviewPlayer from "./PreviewPlayer";
import RenderPanel from "./RenderPanel";
import Automate from "./Automate";
import {
  ArrowIcon,
  FilmIcon,
  ImageIcon,
  MicIcon,
  SparkIcon,
  Spinner,
} from "./icons";

// Friendly names for the per-provider spend breakdown chip.
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude",
  grok: "Grok",
  gemini: "Gemini",
  elevenlabs: "ElevenLabs",
};

export default function Studio({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const projectRef = useRef<Project | null>(null);

  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState<string | undefined>();
  const [voiceName, setVoiceName] = useState<string | undefined>();
  const [model, setModel] = useState<TtsModelId>("eleven_multilingual_v2");
  const [scriptModel, setScriptModel] = useState<StoryModelId>(
    DEFAULT_STORY_MODEL_ID,
  );
  const [sceneModel, setSceneModel] = useState<SceneModelId>(
    DEFAULT_SCENE_MODEL_ID,
  );
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [clips, setClips] = useState<Set<number>>(new Set());
  const [clipVersion, setClipVersion] = useState(0);
  const [clipBatch, setClipBatch] = useState<ClipBatch | null>(null);
  const [imageBatch, setImageBatch] = useState<ImageBatch | null>(null);
  const [images, setImages] = useState<Set<string>>(new Set());
  const [imageVersion, setImageVersion] = useState(0);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [seekReq, setSeekReq] = useState<{ t: number; n: number } | null>(null);
  const previewRef = useRef<HTMLElement>(null);

  const [regenerating, setRegenerating] = useState(false);
  const [voicing, setVoicing] = useState(false);
  const [cutting, setCutting] = useState(false);
  const [generatingSocial, setGeneratingSocial] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
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
      setScriptModel(p.scriptModelId ?? DEFAULT_STORY_MODEL_ID);
      setSceneModel(p.sceneModelId ?? DEFAULT_SCENE_MODEL_ID);
      setScenes(p.scenes ?? []);
      if (p.hasAudio) setAudioSrc(audioUrl(projectId, p.updatedAt));
      void listClips(projectId).then((list) => {
        if (!cancelled) setClips(new Set(list.map((c) => c.index)));
      });
      void getClipBatch(projectId).then((cb) => {
        if (!cancelled) setClipBatch(cb);
      });
      void getImageBatch(projectId).then((ib) => {
        if (!cancelled) setImageBatch(ib);
      });
      void listImages(projectId).then((keys) => {
        if (!cancelled) setImages(new Set(keys));
      });
      void getUsage(projectId).then((u) => {
        if (!cancelled) setUsage(u);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Re-read this project's spend after a billed call (script / scenes / clips).
  function refreshUsage() {
    void getUsage(projectId).then((u) => setUsage(u));
  }

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
          scriptModelId: scriptModel,
          projectId,
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
      refreshUsage();
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
        captionEmphasis: undefined, // word indices changed → re-pick emphasis
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
          title: project.title,
          coreTurn: project.coreTurn,
          scriptStyleId: project.scriptStyleId,
          sceneModelId: sceneModel,
          projectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cut scenes.");
      const next: Scene[] = data.scenes ?? [];
      // A re-cut reassigns scene indices, so the old per-scene clips AND
      // starting-frame stills (both keyed by index) no longer match — drop them.
      // Bible reference images (scope "ref") are keyed by entity id, so they stay.
      await deleteAllClips(projectId);
      await deleteAllImages(projectId, "scene");
      // A re-cut renumbers scenes, so any in-flight clip batch (keyed by the old
      // indices) is invalid — cancel it best-effort and clear it.
      if (clipBatch) {
        void cancelClipBatch(projectId);
        setClipBatch(null);
      }
      // Likewise, an open image batch with scene-frame requests is keyed by the
      // old indices — cancel it. Ref-only batches stay valid and are left alone.
      if (
        imageBatch?.status === "open" &&
        imageBatch.requests.some((r) => r.scope === "scene")
      ) {
        void cancelImageBatch(projectId);
        setImageBatch(null);
      }
      setClips(new Set());
      setClipVersion((v) => v + 1);
      setImages((prev) => {
        const kept = new Set<string>();
        for (const k of prev) if (!k.startsWith("scene:")) kept.add(k);
        return kept;
      });
      setImageVersion((v) => v + 1);
      setScenes(next);
      // Scene generation may grow the visual bible (agent 2 mints reusable
      // entities for recurring subjects); persist the merged bible too.
      save((p) => ({
        ...p,
        scenes: next,
        visualBible: data.visualBible ?? p.visualBible,
        approvedScenes: [], // a re-cut renumbers scenes — approvals are stale
      }));
      refreshUsage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cut scenes.");
    } finally {
      setCutting(false);
    }
  }

  function handleScriptModelChange(id: StoryModelId) {
    setScriptModel(id);
    save((p) => ({ ...p, scriptModelId: id }));
  }

  function handleSceneModelChange(id: SceneModelId) {
    setSceneModel(id);
    save((p) => ({ ...p, sceneModelId: id }));
  }

  function handleClipChange(index: number, has: boolean) {
    setClips((prev) => {
      const next = new Set(prev);
      if (has) next.add(index);
      else next.delete(index);
      return next;
    });
    setClipVersion((v) => v + 1);
  }

  // Mark a scene approved/unapproved (collapses its card); persisted on the project.
  function handleApproveChange(index: number, approved: boolean) {
    save((p) => {
      const set = new Set(p.approvedScenes ?? []);
      if (approved) set.add(index);
      else set.delete(index);
      return { ...p, approvedScenes: Array.from(set).sort((a, b) => a - b) };
    });
  }

  // Build a visual bible from the script (pasted-script projects with no bible).
  // Throws on failure so VisualBibleView shows the message. Billed Claude call.
  async function handleBuildBible() {
    const visualBible = await generateBible(projectId);
    save((p) => ({ ...p, visualBible }));
    refreshUsage();
  }

  // Generate a post caption + 5 hashtags from the script; persist on the project.
  // Billed Claude call → refresh the spend chip.
  async function handleGenerateSocial() {
    setGeneratingSocial(true);
    setSocialError(null);
    try {
      const social = await generateSocial(projectId);
      save((p) => ({ ...p, social }));
      refreshUsage();
    } catch (e) {
      setSocialError(
        e instanceof Error ? e.message : "Could not generate the caption.",
      );
    } finally {
      setGeneratingSocial(false);
    }
  }

  // Let Claude pick which caption words to emphasize; persist the indices so the
  // preview + render highlight them. Billed Claude call → refresh the spend chip.
  async function handleGenerateEmphasis() {
    const indices = await generateCaptionEmphasis(projectId);
    save((p) => ({ ...p, captionEmphasis: indices }));
    refreshUsage();
  }

  // The clip-batch poller saved some clips server-side — reflect them in the UI.
  // The panel only sends newly-downloaded indices, so just merge + bump.
  function handleClipsSaved(indices: number[]) {
    if (indices.length === 0) return;
    setClips((prev) => {
      const next = new Set(prev);
      for (const i of indices) next.add(i);
      return next;
    });
    setClipVersion((v) => v + 1);
  }

  // The image-batch poller stored some images server-side — reflect them in the
  // UI. `keys` are `${scope}:${imageKey}` strings; merge + bump so thumbnails load.
  function handleImagesSaved(keys: string[]) {
    if (keys.length === 0) return;
    setImages((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
    setImageVersion((v) => v + 1);
  }

  function handlePreviewScene(scene: Scene) {
    setSeekReq({ t: scene.tStart, n: Date.now() });
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleToggleRef(id: string, done: boolean) {
    save((p) => {
      const set = new Set(p.refDoneIds ?? []);
      if (done) set.add(id);
      else set.delete(id);
      return { ...p, refDoneIds: Array.from(set) };
    });
  }

  // Generate an image via Nano Banana; throws on failure so the caller can show
  // a per-row message. referenceKeys are bible-entity ids whose ref image (if
  // generated) is passed to the model for consistency.
  async function handleGenerateImage(
    scope: ImageScope,
    key: string,
    prompt: string,
    referenceKeys?: string[],
  ) {
    await generateImage(projectId, {
      scope,
      key,
      prompt,
      referenceKeys,
      flex: project?.flexImages,
      imageModelId: project?.imageModelId,
    });
    setImages((prev) => new Set(prev).add(`${scope}:${key}`));
    setImageVersion((v) => v + 1);
  }

  // Upload a user-supplied image (made outside the app) as a scene frame / ref.
  // Stored server-side as a new master version; mirror it into local state.
  async function handleUploadImage(scope: ImageScope, key: string, file: File) {
    await uploadImage(projectId, scope, key, file);
    setImages((prev) => new Set(prev).add(`${scope}:${key}`));
    setImageVersion((v) => v + 1);
  }

  async function handleDeleteImage(scope: ImageScope, key: string) {
    await deleteImage(projectId, scope, key);
    setImages((prev) => {
      const next = new Set(prev);
      next.delete(`${scope}:${key}`);
      return next;
    });
    setImageVersion((v) => v + 1);
  }

  // Animate a scene's starting frame into its clip with Grok (long-running).
  // Throws on failure so the caller can show a per-scene message.
  async function handleGenerateClip(
    sceneIndex: number,
    prompt: string,
    duration?: number,
    aspectRatio?: string,
  ) {
    await generateClip(projectId, sceneIndex, { prompt, duration, aspectRatio });
    setClips((prev) => new Set(prev).add(sceneIndex));
    setClipVersion((v) => v + 1);
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
        {usage && usage.totalUsd > 0 && (
          <span
            className="chip shrink-0"
            title="Total API spend for this project (Gemini image generation is not metered)"
          >
            Spend {formatUsd(usage.totalUsd)}
            <span className="ml-1.5 text-faint">
              {Object.entries(usage.byProvider)
                .sort((a, b) => b[1].usd - a[1].usd)
                .map(
                  ([k, v]) =>
                    `${PROVIDER_LABELS[k] ?? k} ${formatUsd(v.usd)}`,
                )
                .join("  ·  ")}
            </span>
          </span>
        )}
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
          scriptModel={scriptModel}
          onScriptModelChange={handleScriptModelChange}
          canRegenerate={Boolean(project.redditText?.trim())}
        />

        {script.trim() && (
          <Automate
            hasAudio={hasAudio}
            scriptDirty={scriptDirty}
            scenes={scenes}
            clips={clips}
            bible={project.visualBible}
            images={images}
            refDoneIds={project.refDoneIds ?? []}
          />
        )}

        <section className="surface p-5">
          <p className="eyebrow flex items-center gap-2">
            <ImageIcon width={14} height={14} /> Image generation
          </p>
          <p className="mt-1 text-xs text-faint">
            Used for bible reference images and scene starting frames (Nano
            Banana, in-app).
          </p>

          <p className="eyebrow mb-2 mt-4">Model</p>
          <div className="grid grid-cols-3 gap-2">
            {IMAGE_MODELS.map((m) => {
              const active =
                m.id === (project.imageModelId ?? DEFAULT_IMAGE_MODEL_ID);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => save((p) => ({ ...p, imageModelId: m.id }))}
                  title={m.blurb}
                  className={`btn !px-3 !py-2 !text-xs ${
                    active ? "btn-ember" : "btn-ghost opacity-80"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => save((p) => ({ ...p, flexImages: !p.flexImages }))}
            className={`btn mt-4 !text-xs ${
              project.flexImages ? "btn-ember" : "btn-ghost opacity-80"
            }`}
          >
            Flex tier {project.flexImages ? "on" : "off"}
          </button>
          <p className="mt-2 text-xs text-faint">
            Flex: ~50% cheaper, but slower (minutes) and best-effort — may retry.
          </p>
        </section>

        <VisualBibleView
          bible={project.visualBible}
          styleId={project.stylePresetId}
          projectId={projectId}
          images={images}
          imageVersion={imageVersion}
          refDoneIds={project.refDoneIds ?? []}
          onGenerateImage={handleGenerateImage}
          onDeleteImage={handleDeleteImage}
          onToggleRef={handleToggleRef}
          onBuildBible={script.trim() ? handleBuildBible : undefined}
        />

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

            {!hasAudio ? (
              <p className="text-xs text-faint">
                Generate a voiceover first — the AI reads its timestamps to cut
                beats.
              </p>
            ) : (
              <p className="text-xs text-faint">
                The AI cuts the narration into visual beats and picks each
                shot&rsquo;s length (up to 15s), tiling the whole voiceover.
                {scenes.length > 0 &&
                  ` ${scenes.length} beats · ${formatClock(coverage.totalSpoken)} voiceover.`}
              </p>
            )}

            <div>
              <p className="eyebrow mb-2">Model</p>
              <div className="grid grid-cols-3 gap-2">
                {SCENE_MODELS.map((m) => {
                  const active = m.id === sceneModel;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSceneModelChange(m.id)}
                      disabled={cutting}
                      title={m.blurb}
                      className={`btn !px-3 !py-2 !text-xs ${
                        active ? "btn-ember" : "btn-ghost opacity-80"
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>

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

        {scenes.length > 0 && audioSrc && (
          <section ref={previewRef} className="surface p-5">
            <p className="eyebrow mb-3 flex items-center gap-2">
              <FilmIcon width={14} height={14} /> Preview
            </p>
            <PreviewPlayer
              audioSrc={audioSrc}
              scenes={scenes}
              projectId={projectId}
              clips={clips}
              clipVersion={clipVersion}
              images={images}
              imageVersion={imageVersion}
              duration={project.audioDuration}
              seekReq={seekReq}
              captions={words}
              showCaptions={project.renderCaptions ?? true}
              emphasis={project.captionEmphasis ?? []}
            />
            <p className="mx-auto mt-3 max-w-sm text-center text-xs text-faint">
              Drop a clip onto each scene below — they play in order under your
              voiceover. Empty scenes show a placeholder.
            </p>
          </section>
        )}

        {scenes.length > 0 && audioSrc && (
          <RenderPanel
            projectId={projectId}
            sceneCount={scenes.length}
            clipCount={clips.size}
            hasAudio={Boolean(audioSrc)}
            captions={project.renderCaptions ?? true}
            onCaptionsChange={(on) =>
              save((p) => ({ ...p, renderCaptions: on }))
            }
            emphasisCount={project.captionEmphasis?.length ?? 0}
            onGenerateEmphasis={handleGenerateEmphasis}
          />
        )}

        {(project.visualBible.characters.length +
          project.visualBible.locations.length >
          0 ||
          scenes.length > 0) && (
          <ImageBatchPanel
            projectId={projectId}
            bible={project.visualBible}
            scenes={scenes}
            styleId={project.stylePresetId}
            conceptStyleId={project.conceptStylePresetId}
            imageModelId={project.imageModelId}
            images={images}
            imageBatch={imageBatch}
            onImageBatchChange={setImageBatch}
            onImagesSaved={handleImagesSaved}
          />
        )}

        {scenes.length > 0 && (
          <ClipBatchPanel
            projectId={projectId}
            scenes={scenes}
            styleId={project.stylePresetId}
            conceptStyleId={project.conceptStylePresetId}
            images={images}
            clips={clips}
            clipBatch={clipBatch}
            onClipBatchChange={setClipBatch}
            onClipsSaved={handleClipsSaved}
          />
        )}

        {scenes.length > 0 && (
          <SceneList
            scenes={scenes}
            styleId={project.stylePresetId}
            conceptStyleId={project.conceptStylePresetId}
            characters={project.visualBible.characters}
            locations={project.visualBible.locations}
            coverage={coverage}
            projectId={projectId}
            clips={clips}
            clipVersion={clipVersion}
            onClipChange={handleClipChange}
            onPreview={handlePreviewScene}
            images={images}
            imageVersion={imageVersion}
            onGenerateImage={handleGenerateImage}
            onUploadImage={handleUploadImage}
            onDeleteImage={handleDeleteImage}
            onGenerateClip={handleGenerateClip}
            approved={new Set(project.approvedScenes ?? [])}
            onApproveChange={handleApproveChange}
          />
        )}

        {script.trim() && (
          <SocialCard
            description={project.social?.description}
            hashtags={project.social?.hashtags}
            onGenerate={handleGenerateSocial}
            generating={generatingSocial}
            error={socialError}
          />
        )}
      </div>
    </div>
  );
}
