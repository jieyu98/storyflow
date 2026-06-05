@AGENTS.md

# StoryFlow — codebase guide

A Next.js 16 / React 19 / Tailwind v4 app that turns pasted Reddit text into the
assets for a short-form vertical (9:16) video: a narration script, an ElevenLabs
voiceover, and per-scene image + animation prompts.

**Product boundary:** the app's core output is **text + the voiceover mp3**. It
can now also generate media **in-app**, each gated behind its own key and an
explicit user action (the Visual bible / scene cards):
- **Still images** via Gemini ("Nano Banana") — `GEMINI_API_KEY`.
- **Video clips** via Grok image-to-video ("Grok Imagine") — `XAI_API_KEY`:
  animates a scene's generated starting frame into its clip.

The **manual workflow stays first-class**: with no keys, you copy the prompts into
your own image tool and upload your own clips, and everything still works.
**Don't wire up a new external media API, or expand what's generated, without
asking.**

## Pipeline (which step calls what)

1. **Write script** (`/api/story` → Claude). Source text → `{ title, coreTurn?,
   script, visualBible }`. The system prompt comes from the chosen writing style
   (`src/lib/scriptStyles.ts`); structured output via forced tool `emit_story`.
2. **Generate voiceover** (`/api/tts` → ElevenLabs only). Script →
   `with-timestamps` endpoint → `{ audioBase64, alignment }` (character-level).
   No Claude here.
3. **Generate scenes** (`/api/scenes` → Claude, one pass). Gets `scriptStyleId` +
   the narration as numbered words tagged with end-times + the visual bible, and
   returns ordered **beats** (`emit_scenes`: each beat = the word index it ENDS
   on, a name, `shotType`, image prompt, animation prompt, `visualMode`
   live/concept, `characterIds`, `locationIds`). It can also return
   `bibleAdditions` — NEW recurring subjects (e.g. a ladder motif, a laptop) that
   agent 1 didn't capture; `mergeSceneEntities` folds these into the bible
   (tagged `origin:"scene"`, additive, pruned on re-cut) so they get a reusable
   reference image too. The scene **system prompt is per writing style**
   (`getSceneSystem` → `SCENE_SYSTEM` for stories, `SCENE_SYSTEM_EXPLAINER` for
   the YSK explainer). `/api/scenes` then calls `buildScenesFromBeats` to turn the
   beats into contiguous scenes with EXACT timing from the timestamps, and returns
   `{ scenes, visualBible }` (the merged bible).
4. **Generate images** (`/api/projects/[id]/images/generate` → Gemini, optional).
   `src/lib/gemini.ts` calls Nano Banana with a prompt (+ any reference images as
   `inlineData` for consistency) and stores the result in the `images` table
   (`scope` `ref`|`scene`). Driven by the Visual bible (refs) and scene cards
   (scene frames); needs `GEMINI_API_KEY`.
5. **Generate clips** (`/api/projects/[id]/clips/[index]/generate` → Grok,
   optional). `src/lib/grok.ts` animates the scene's generated starting frame
   (inlined as a base64 data URI) with its animation prompt via the **async** xAI
   video API (submit → poll → download the mp4), storing it in the `clips` table.
   Needs `XAI_API_KEY`. Clips can also still be uploaded manually.

So Claude is called in steps 1 and 3; ElevenLabs only in step 2; Gemini in step 4
(images); Grok in step 5 (video); the scene geometry/timing is computed locally.

## Scene model (important — read before touching scenes)

- The **AI picks the beat boundaries** (semantic visual beats), the **timestamps
  give the real durations**. There are **no fixed 4/6/8/10 buckets** — that was
  removed. Don't reintroduce duration toggles.
- Clip length is an **integer**: `min(ceil(spokenSeconds), MAX_CLIP_SECONDS)`
  (image-to-video tools take whole seconds). The **AI chooses each beat's length**
  by content + pacing; `MAX_CLIP_SECONDS` (15) is a fixed hard ceiling — the old
  user-adjustable max-clip control was removed. `scene.clamped` is set if a beat
  exceeds the ceiling.
- **Two-track visuals**: each beat is tagged `visualMode` **live** (a real,
  filmable object/action → the project's primary art style) or **concept** (a
  visualization of an invisible idea → `conceptStylePresetId`). `styleForScene`
  resolves the style per scene at display time. `shotType` drives shot variety.
  No text is ever baked into the image prompt (image tools garble text) —
  meaning is carried by the visual itself.
- **Cross-shot consistency**: `composeReferencePrompt` builds a canonical
  reference-image prompt per bible entity (surfaced in `VisualBibleView`); beats
  carry `characterIds`/`locationIds` so each scene knows which reference to reuse.
  Agent 1 fixes the cast, but agent 2 can **grow the bible** during cutting
  (`bibleAdditions` → `mergeSceneEntities`) for recurring subjects it chooses to
  feature, so those get a reusable reference image and stay identical across shots.
- **Per-scene recipe** (`src/lib/recipe.ts`, `buildSceneRecipes`): a pure,
  deterministic step-by-step production guide per scene (generate fresh vs upload
  a reference; image→video vs extend), computed at render time.
- `buildScenesFromBeats` (`src/lib/scenes.ts`) is deliberately robust to bad AI
  indices: ranges are forced contiguous and the last scene always reaches the
  final word. It derives scene `text`/timing from the words, not from any
  AI-provided text, so what's shown always matches the audio.
- `src/lib/alignment.ts` rebuilds word timings from ElevenLabs' character arrays
  (use `alignment`, not `normalized_alignment`).

## Where things live

- `src/app/page.tsx` — home: paste box, writing-style + art-style pickers,
  project list. Client component; creates the `Project` and routes to studio.
- `src/app/studio/[projectId]/page.tsx` → `src/components/Studio.tsx` — the
  orchestrator (script, bible, voiceover, scene generation, persistence).
- `src/lib/types.ts` — shared types; `Project`, `Scene`, `MAX_CLIP_SECONDS`.
- `src/lib/scriptStyles.ts` — writing-style presets (system prompts) + `SAFETY`;
  a style may override the scene prompt (`sceneSystem`) and recommend art styles
  (`recommendedArtStyleId`/`recommendedConceptStyleId`); `getSceneSystem` /
  `getScriptStyle` resolve them.
- `src/lib/styles.ts` — art-style presets; `composeImagePrompt` appends the style
  at display time (switching styles never re-calls AI); `styleForScene` picks
  primary vs concept style per scene; `composeReferencePrompt` builds the
  per-entity reference-image prompt.
- `src/lib/prompts.ts` — tool schemas (`STORY_TOOL`, `SCENE_TOOL`) + scene system
  prompts: `SCENE_SYSTEM` (story styles) and `SCENE_SYSTEM_EXPLAINER` (YSK explainer).
- `src/lib/recipe.ts` — `buildSceneRecipes`: per-scene production steps (pure).
- `src/lib/anthropic.ts` — `generateStory`, `generateSceneBeats` (forced tool use + prompt caching).
- `src/lib/elevenlabs.ts` — `listVoices` (v2), `ttsWithTimestamps`.
- `src/lib/gemini.ts` — `generateImage` (Nano Banana via `generateContent`): text
  prompt + optional reference images → one still. The model is **user-selectable
  per project** (`IMAGE_MODELS` → `Project.imageModelId`: Pro / Flash / original
  Nano Banana), allowlisted in the generate route and falling back to
  `GEMINI_IMAGE_MODEL` (`src/server/env.ts`, default `gemini-3-pro-image`). A
  `flex` option (`Project.flexImages`) uses the **Flex service tier** (~50%
  cheaper, slower) — adds `service_tier:"flex"` + retry-on-503/429 with backoff +
  a long timeout. Both are set in the studio's **Image generation** section. The
  only place the app generates **stills**; gated behind `GEMINI_API_KEY`. (Video
  lives in `src/lib/grok.ts`, listed below.)
- `src/lib/storage.ts` — **client** async wrapper over `/api/projects` (+ a
  one-time `migrateLegacy` from the old browser localStorage/IndexedDB); also the
  image helpers (`generateImage`, `imageUrl`, `listImages`, `deleteImage`) and
  `generateClip` (Grok image-to-video → the scene's clip).
- `src/server/db.ts` — **server** SQLite (better-sqlite3) at `.data/storyflow.db`:
  `projects` (Project JSON) + `audio` (mp3 BLOB) + `clips` (per-scene video BLOB,
  uploaded or Grok-generated) + `images` (generated stills BLOB, keyed by
  `scope`/`key`) + `usage` (one row per billed API call: provider/model/operation
  + tokens + `cost_usd`; nullable `project_id`, kept even after the project is
  deleted). `recordUsage` / `usageSummary(projectId?)`.
- **Cost tracking** — `src/lib/pricing.ts` (`anthropicCost`: pure, cache-aware
  USD/MTok rates — edit when Anthropic pricing changes) → `src/server/usage.ts`
  (`recordAnthropicUsage`: prices + logs, never throws) called from the `/api/story`
  and `/api/scenes` handlers. `GET /api/usage[?projectId=]` returns a spend summary
  (`totalUsd`, `byOperation`, `byModel`); the studio shows a per-project Claude
  chip and the home page a global total. Both Claude calls return `{…, usage,
  model }`; only Claude is metered so far.
- `src/app/api/projects/*` — project CRUD, `[id]/audio` GET/PUT,
  `[id]/clips` (list) + `[id]/clips/[index]` GET/PUT/DELETE +
  `[id]/clips/[index]/generate` (POST → Grok), and `[id]/images` (list +
  DELETE `?scope=` for bulk drop) + `[id]/images/generate` (POST) +
  `[id]/images/[scope]/[key]` GET/DELETE. Regenerating scenes drops the old
  clips AND `scope:"scene"` stills (both keyed by index, so a re-cut invalidates
  them); `scope:"ref"` bible images are keyed by entity id and kept.
- `src/components/Automate.tsx` — a slim **progress readout** shown under the
  script: a progress bar + one-line status across the four stages (voiceover,
  scenes, references, clips). It performs **no** actions — each stage is done in
  its own section below (Voiceover, Scenes, Visual bible, Scene list); this is
  just an at-a-glance "where am I". Read-only, so it only takes data props.
- `src/components/VisualBibleView.tsx` — the collapsible **Visual bible**: each
  character/location's description + reference prompt, and the in-app
  **reference-image generation** (Nano Banana `Generate`/`Regenerate`/delete, or
  copy the prompt / tick `Project.refDoneIds` to do it manually). Generate each
  reference once; it's then reused in every scene that entity appears in.
- `src/components/SceneCard.tsx` — per-scene card: prompts, recipe, optional
  in-app starting-frame generation (`onGenerateImage`, passing that scene's
  `characterIds`/`locationIds` reference images to Gemini for cross-shot
  consistency) and clip generation (`onGenerateClip` → Grok, enabled once the
  frame exists), and the clip drop. Rendered by `SceneList`.
- `src/lib/grok.ts` — `generateVideoAndWait`: submit + poll the async xAI video
  API, return the finished mp4 url. `GROK_VIDEO_MODEL` in `src/server/env.ts`;
  gated behind `XAI_API_KEY`. The only place the app generates video.
- `src/components/ClipDrop.tsx` — per-scene clip upload (drag/drop → `/clips`).
- `src/components/PreviewPlayer.tsx` + `src/remotion/PreviewComposition.tsx` — the
  9:16 preview. It is a **Remotion `<Player>`** (a player, NOT a renderer — no
  video export, stays within the product boundary) driving a composition that
  sequences each scene's clip under the voiceover by real timing and shows a
  placeholder for clip-less scenes. `PreviewPlayer`
  runs the Player headless and keeps the campfire-styled controls + a full-width
  per-scene timeline.
- `src/server/env.ts` — lazy, typed secret access; `ANTHROPIC_MODEL`.

## Conventions

- **Secrets** only via `serverEnv` in `src/server/env.ts` (lazy getters; throw at
  request time, never at build). Keys live in `.env.local` (gitignored).
- **Claude calls** use forced tool use for structured output, with
  `cache_control` on the system prompt. `ANTHROPIC_MODEL`
  (`claude-sonnet-4-6`) is the default, but both Claude steps are
  **user-selectable** (Sonnet/Opus/Haiku) and persisted on the Project:
  script writing via `STORY_MODELS` → `Project.scriptModelId` (home page +
  `ScriptCard` picker), scene cutting via `SCENE_MODELS` → `Project.sceneModelId`
  (Scenes-section picker). Each route allowlists the id before passing it to the
  lib, which falls back to `ANTHROPIC_MODEL`. The actual model used is recorded in
  the `usage` table for cost tracking.
- **Design system** lives in `src/app/globals.css` (Tailwind v4 `@theme` tokens:
  ink/cream/ember/twilight, fonts Fraunces/Hanken/JetBrains Mono, `.surface`,
  `.btn-ember`, `.field`, grain + glow). Reuse these classes; the look is a dark
  "campfire studio".
- **Persistence is server-side SQLite** at `.data/storyflow.db` (gitignored).
  The client (`src/lib/storage.ts`) is async and talks to `/api/projects`; the
  whole `Project` is stored as JSON, the mp3 as a BLOB. New project fields just
  go on the `Project` type — no schema migration needed. better-sqlite3 is
  marked external in `next.config.ts` (`serverExternalPackages`).
  Inspect the DB: `sqlite3 .data/storyflow.db "SELECT json_extract(data,'$.title'), data FROM projects;"`

## Commands

```bash
npm run dev      # Turbopack dev server
npm run build    # production build (runs typecheck)
node_modules/.bin/tsc --noEmit   # typecheck only
```

Pure logic in `src/lib/scenes.ts` / `alignment.ts` / `recipe.ts` is unit-testable
by compiling those files standalone (`tsc <files> --outDir /tmp/... --module
commonjs`) and running with node — no app or keys needed.

## Gotchas

- This is **Next.js 16** — see `AGENTS.md`; APIs differ from older versions.
- Scenes need a voiceover first (they're cut from its timestamps); the Generate
  scenes button is disabled until one exists.
- Editing the script after voicing flags it out-of-sync; regenerate the
  voiceover to re-align before recutting scenes.
