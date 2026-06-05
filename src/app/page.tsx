"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PresetCards, { type PresetOption } from "@/components/PresetCards";
import ProjectList from "@/components/ProjectList";
import { ArrowIcon, SparkIcon, Spinner } from "@/components/icons";
import { ART_STYLES, DEFAULT_STYLE_ID } from "@/lib/styles";
import {
  DEFAULT_SCRIPT_STYLE_ID,
  SCRIPT_STYLES,
  getScriptStyle,
} from "@/lib/scriptStyles";
import {
  deleteProject,
  getUsage,
  listProjects,
  migrateLegacy,
  newProjectId,
  upsertProject,
} from "@/lib/storage";
import {
  DEFAULT_STORY_MODEL_ID,
  STORY_MODELS,
  type Project,
  type StoryModelId,
} from "@/lib/types";
import { countWords, formatUsd } from "@/lib/text";

export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [styleId, setStyleId] = useState(DEFAULT_STYLE_ID);
  const [scriptStyleId, setScriptStyleId] = useState(DEFAULT_SCRIPT_STYLE_ID);
  const [scriptModelId, setScriptModelId] =
    useState<StoryModelId>(DEFAULT_STORY_MODEL_ID);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [claudeUsd, setClaudeUsd] = useState(0);

  const scriptStyleOptions: PresetOption[] = useMemo(
    () => SCRIPT_STYLES.map((s) => ({ id: s.id, name: s.name, sub: s.tagline })),
    [],
  );
  const artStyleOptions: PresetOption[] = useMemo(
    () => ART_STYLES.map((s) => ({ id: s.id, name: s.name, sub: s.tagline })),
    [],
  );

  // Picking a writing style applies its recommended art style (user can still override).
  function handleScriptStyle(id: string) {
    setScriptStyleId(id);
    const rec = getScriptStyle(id).recommendedArtStyleId;
    if (rec) setStyleId(rec);
  }

  useEffect(() => {
    migrateLegacy().then(() => listProjects().then(setProjects));
    void getUsage().then((u) => setClaudeUsd(u.totalUsd));
  }, []);

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    try {
      // Mint the id up front so the (billed) story call is attributed to this
      // project, even though the project row is saved after the response.
      const id = newProjectId();
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          redditText: text,
          scriptStyleId,
          scriptModelId,
          projectId: id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not write the script.");

      const now = Date.now();
      const project: Project = {
        id,
        title: data.title || "Untitled story",
        createdAt: now,
        updatedAt: now,
        redditText: text,
        script: data.script,
        coreTurn: data.coreTurn || undefined,
        visualBible: data.visualBible ?? { characters: [], locations: [] },
        scriptStyleId,
        scriptModelId,
        stylePresetId: styleId,
        conceptStylePresetId: getScriptStyle(scriptStyleId).recommendedConceptStyleId,
        scenes: [],
      };
      await upsertProject(project);
      router.push(`/studio/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    setProjects(await listProjects());
  }

  const words = countWords(text);

  return (
    <div className="relative z-[1] mx-auto flex min-h-full max-w-3xl flex-col px-5 pb-24 pt-7">
      {/* Brand */}
      <header className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-ember-400 to-ember-600 text-[#25150a] shadow-[0_8px_24px_-10px_rgba(255,123,58,0.8)]">
          <SparkIcon width={17} height={17} />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight">
          StoryFlow
        </span>
        <span className="chip ml-auto">Reddit → reels</span>
      </header>

      {/* Hero */}
      <section className="mt-16 rise" style={{ animationDelay: "60ms" }}>
        <p className="eyebrow">The story workshop</p>
        <h1 className="headline mt-4 text-5xl sm:text-6xl">
          Paste a thread.
          <br />
          Walk out with a{" "}
          <span className="italic text-ember-400">reel-ready</span> script.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
          Drop in any Reddit story. StoryFlow rewrites it into a tight narration,
          voices it with ElevenLabs, then cuts it into timed scenes — each with a
          starting-frame image prompt and an animation prompt ready to paste into
          your own tools.
        </p>
      </section>

      {/* Composer */}
      <section
        className="surface mt-9 rise p-5 sm:p-6"
        style={{ animationDelay: "140ms" }}
      >
        <label htmlFor="reddit" className="eyebrow">
          Source text
        </label>
        <textarea
          id="reddit"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the Reddit post here — AITA confessions, r/nosleep, glow-ups, revenge arcs. The messier the better; we'll tighten it."
          rows={9}
          className="field mt-3"
          spellCheck={false}
        />

        <div className="mt-5">
          <p className="eyebrow mb-2">Writing style</p>
          <PresetCards
            options={scriptStyleOptions}
            value={scriptStyleId}
            onChange={handleScriptStyle}
          />
          <p className="mt-2 text-xs text-faint">
            How the narration is written. Sets a starting clip-length mix you can
            change later.
          </p>
        </div>

        <div className="mt-5">
          <p className="eyebrow mb-2">Art style</p>
          <PresetCards
            options={artStyleOptions}
            value={styleId}
            onChange={setStyleId}
          />
          <p className="mt-2 text-xs text-faint">
            Appended to every scene&rsquo;s image prompt so your frames stay
            consistent.
          </p>
        </div>

        <div className="mt-5">
          <p className="eyebrow mb-2">Script model</p>
          <div className="grid grid-cols-3 gap-2">
            {STORY_MODELS.map((m) => {
              const active = m.id === scriptModelId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setScriptModelId(m.id)}
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
          <p className="mt-2 text-xs text-faint">
            Which Claude writes the narration. Opus is the richest; Haiku the
            cheapest.
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-ember-600/40 bg-ember-600/10 px-4 py-2.5 text-sm text-ember-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-faint">
            {words > 0 ? `${words} words pasted` : "Awaiting your thread"}
          </span>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || words < 5}
            className="btn btn-ember"
          >
            {loading ? (
              <>
                <Spinner width={16} height={16} /> Writing the script…
              </>
            ) : (
              <>
                <SparkIcon width={16} height={16} /> Write the script
                <ArrowIcon width={16} height={16} />
              </>
            )}
          </button>
        </div>
      </section>

      {/* Library */}
      <section className="mt-14 rise" style={{ animationDelay: "220ms" }}>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold">Your studio</h2>
          <span className="text-xs text-faint">
            {claudeUsd > 0 && (
              <span title="Total Claude API spend across all projects">
                Claude spend {formatUsd(claudeUsd)} ·{" "}
              </span>
            )}
            {projects.length} {projects.length === 1 ? "draft" : "drafts"}
          </span>
        </div>
        <ProjectList projects={projects} onDelete={handleDelete} />
      </section>
    </div>
  );
}
