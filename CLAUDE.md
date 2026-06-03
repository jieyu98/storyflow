@AGENTS.md

# StoryFlow — codebase guide

A Next.js 16 / React 19 / Tailwind v4 app that turns pasted Reddit text into the
assets for a short-form vertical (9:16) video: a narration script, an ElevenLabs
voiceover, and per-scene image + animation prompts.

**Firm product boundary:** the app outputs **text + the voiceover mp3 only**. It
never generates images or video — the user copies prompts into their own tools
(images: Nano Banana / GPT-Image; motion: Grok image-to-video, currently). Don't
add in-app media generation without asking.

## Pipeline (which step calls what)

1. **Write script** (`/api/story` → Claude). Source text → `{ title, coreTurn?,
   script, visualBible }`. The system prompt comes from the chosen writing style
   (`src/lib/scriptStyles.ts`); structured output via forced tool `emit_story`.
2. **Generate voiceover** (`/api/tts` → ElevenLabs only). Script →
   `with-timestamps` endpoint → `{ audioBase64, alignment }` (character-level).
   No Claude here.
3. **Generate scenes** (`/api/scenes` → Claude, one pass). The AI gets the
   narration as numbered words tagged with end-times + the visual bible, and
   returns ordered **beats** (`emit_scenes`: each beat = the word index it ENDS
   on, a name, image prompt, animation prompt, characterIds). `/api/scenes` then
   calls `buildScenesFromBeats` to turn those into contiguous scenes with EXACT
   timing from the timestamps.

So Claude is called in steps 1 and 3; ElevenLabs only in step 2; the scene
geometry/timing is computed locally.

## Scene model (important — read before touching scenes)

- The **AI picks the beat boundaries** (semantic visual beats), the **timestamps
  give the real durations**. There are **no fixed 4/6/8/10 buckets** — that was
  removed. Don't reintroduce duration toggles.
- Clip length is an **integer**: `min(ceil(spokenSeconds), maxClipSeconds)`
  (image-to-video tools take whole seconds; default max 10s, user-adjustable).
  `scene.clamped` is set if a beat runs longer than the cap (audio would
  overflow).
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
- `src/lib/types.ts` — shared types; `Project`, `Scene`, `DEFAULT_MAX_CLIP_SECONDS`.
- `src/lib/scriptStyles.ts` — writing-style presets (system prompts) + `SAFETY`.
- `src/lib/styles.ts` — art-style presets; `composeImagePrompt` appends the
  style at display time (so switching styles never re-calls AI).
- `src/lib/prompts.ts` — tool schemas (`STORY_TOOL`, `SCENE_TOOL`) + scene system prompt.
- `src/lib/anthropic.ts` — `generateStory`, `generateSceneBeats` (forced tool use + prompt caching).
- `src/lib/elevenlabs.ts` — `listVoices` (v2), `ttsWithTimestamps`.
- `src/lib/storage.ts` — **client** async wrapper over `/api/projects` (+ a
  one-time `migrateLegacy` from the old browser localStorage/IndexedDB).
- `src/server/db.ts` — **server** SQLite (better-sqlite3) at `.data/storyflow.db`:
  `projects` (whole Project as JSON) + `audio` (mp3 BLOB).
- `src/app/api/projects/*` — project CRUD + `[id]/audio` GET/PUT.
- `src/server/env.ts` — lazy, typed secret access; `ANTHROPIC_MODEL`.

## Conventions

- **Secrets** only via `serverEnv` in `src/server/env.ts` (lazy getters; throw at
  request time, never at build). Keys live in `.env.local` (gitignored).
- **Claude calls** use forced tool use for structured output, with
  `cache_control` on the system prompt. Model is `ANTHROPIC_MODEL`
  (`claude-sonnet-4-6`).
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

Pure logic in `src/lib/scenes.ts` / `alignment.ts` is unit-testable by compiling
those two files standalone (`tsc <files> --outDir /tmp/... --module commonjs`)
and running with node — no app or keys needed.

## Gotchas

- This is **Next.js 16** — see `AGENTS.md`; APIs differ from older versions.
- Scenes need a voiceover first (they're cut from its timestamps); the Generate
  scenes button is disabled until one exists.
- Editing the script after voicing flags it out-of-sync; regenerate the
  voiceover to re-align before recutting scenes.
