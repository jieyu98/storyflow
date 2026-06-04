# StoryFlow

Turn a pasted Reddit thread into the building blocks of a short-form vertical
video (TikTok / YouTube Shorts). StoryFlow writes a narration script, voices it
with ElevenLabs (with word-level timestamps), cuts it into timed scenes, and
hands you a **starting-frame image prompt** and an **animation prompt** for each
scene — ready to paste into your own image and image-to-video tools.

StoryFlow produces text + the voiceover audio, and can **generate the still
images in-app** with Gemini ("Nano Banana") — optional, behind your own
`GEMINI_API_KEY`. It does **not** generate **video**: you make the motion clips in
your own image-to-video tool (Grok / Kling / Veo) and drop them in. The
prompt-copy manual workflow still works with no Gemini key.

## How it works

1. **Paste** a Reddit story on the home page, then pick a **writing style** and
   an **art style**.
2. Claude rewrites it into a tight ≥60s narration and a **visual bible**
   (recurring characters + locations with fixed descriptions, so frames stay
   consistent). The _Recognition shorts_ style also surfaces a one-line
   **core turn** (the spine + emotional register).
3. In the **Studio**, pick one of your ElevenLabs voices and generate a
   timestamped voiceover.
4. Hit **Generate scenes**. The AI reads the narration *with its word
   timestamps* and cuts it into visual beats, writing each beat's image +
   animation prompt in the same pass. It **chooses each beat's length** from its
   content and pacing (integer seconds, hard ceiling 15s — no manual max). Every
   beat is tagged **live** (a real, filmable shot) or **concept** (a diagram /
   visualization of an invisible idea); the two render in different art styles
   automatically. The storyboard prompt itself is **per writing style** (the YSK
   explainer gets its own director).
5. Each scene card shows its beat name, time range, integer clip length, shot
   type, and copy buttons for the image prompt (the right art-style preset
   appended) and animation prompt — plus any **on-screen text** to overlay, a
   **production recipe** (generate fresh vs. reuse a reference image; image→video
   vs. extend), and which **reference images** to reuse for consistency. The
   Visual bible has a copy button for each entity's canonical **reference prompt**.
6. Generate each clip in your own image-to-video tool, then **drag it onto its
   scene** and hit **Preview**. The preview is a **Remotion player** that
   sequences the clips under the voiceover by real scene timing, burns in any
   **on-screen text**, and shows a placeholder for clip-less scenes — with a
   full-width per-scene **timeline** below it. (It's a player, not a renderer:
   StoryFlow still doesn't export video.)

The **Automate** panel under the script ties this together as a guided stepper:
**voiceover** → **scenes** → **reference images** → **scene 1, 2, …**. With a
`GEMINI_API_KEY`, the reference images and each scene's 9:16 starting frame can be
**generated in-app** (Nano Banana) right from the step — scene frames pass that
scene's reference images through for consistency. Without a key, each step still
shows the exact prompt to copy into your own tool. You always supply the motion
clips yourself.

Projects are saved in a local **SQLite** database (`.data/storyflow.db`, created
on first run) via the app's own API — the whole project as JSON, the mp3 as a
BLOB. Projects left over from the old browser-storage version migrate into
SQLite automatically the first time you open the app. Inspect it directly with
e.g. `sqlite3 .data/storyflow.db "SELECT json_extract(data,'\$.scenes') FROM projects;"`.

## Setup

```bash
cp .env.example .env.local      # add your two API keys
npm install
npm run dev                     # http://localhost:3000
```

Required env vars (see `.env.example`):

- `ANTHROPIC_API_KEY` — script, visual bible, and scene cut/prompts.
- `ELEVENLABS_API_KEY` — voice list + timestamped voiceover.
- `GEMINI_API_KEY` — *optional*; in-app still generation ("Nano Banana"). Without
  it, copy the prompts into your own image tool instead.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Anthropic SDK ·
ElevenLabs REST · Remotion (`@remotion/player`, preview only).

Key modules:

- `src/lib/alignment.ts` — word timings from ElevenLabs character alignment.
- `src/lib/scenes.ts` — assembles the AI's chosen beats into contiguous scenes
  with exact timing (integer clip = `ceil(spoken seconds)`, capped at the fixed
  `MAX_CLIP_SECONDS` = 15s ceiling).
- `src/lib/recipe.ts` — derives each scene's step-by-step production recipe.
- `src/lib/anthropic.ts` / `src/lib/prompts.ts` — structured story generation and
  the cut-and-prompt pass. `prompts.ts` holds two scene system prompts:
  `SCENE_SYSTEM` (story styles) and `SCENE_SYSTEM_EXPLAINER` (explainer).
- `src/lib/scriptStyles.ts` — writing-style presets (the system prompt Claude
  adopts) + shared safety guardrails; a style can override the scene prompt and
  recommend art styles.
- `src/lib/styles.ts` — art-style presets (`composeImagePrompt` appends one at
  copy time), `styleForScene` (live vs. concept), and `composeReferencePrompt`
  (per-entity reference image for consistency).
- `src/server/db.ts` — SQLite persistence (better-sqlite3).
- `src/components/Automate.tsx` — the guided pipeline stepper.
- `src/components/PreviewPlayer.tsx` + `src/remotion/PreviewComposition.tsx` — the
  in-browser Remotion preview (player only, no export).
- `src/app/api/*` — `story`, `voices`, `tts`, `scenes`, and `projects` (CRUD +
  audio) route handlers.

## Customizing

- **Writing styles** — add an entry to `SCRIPT_STYLES` in
  `src/lib/scriptStyles.ts`. Each carries its own `system` prompt and may add an
  optional `sceneSystem` (its own storyboard prompt) plus recommended art styles.
  Ships with _Straight narrator_, _Recognition shorts_, and _You should know_
  (r/YouShouldKnow explainer). All inherit the shared `SAFETY` guardrails.
- **Art styles** — add an entry to `ART_STYLES` in `src/lib/styles.ts`. Its
  `prompt` string is appended to a scene's image prompt at copy time, so switching
  styles never re-calls the AI. Ships with Pixar Campfire, Clean Explainer 3D,
  Documentary Realism, and Explainer Graphics (the flat look used for _concept_
  scenes).
- **Clip length** — chosen by the AI per beat (no manual control); the hard
  ceiling is `MAX_CLIP_SECONDS` in `src/lib/types.ts`.

## Scripts

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build (also typechecks)
npm run lint     # eslint
```
