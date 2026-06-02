# StoryFlow

Turn a pasted Reddit thread into the building blocks of a short-form vertical
video (TikTok / YouTube Shorts). StoryFlow writes a narration script, voices it
with ElevenLabs (with word-level timestamps), cuts it into timed scenes, and
hands you a **starting-frame image prompt** and an **animation prompt** for each
scene — ready to paste into your own image and image-to-video tools.

StoryFlow does **not** generate images or video itself. It produces text + the
voiceover audio; you take the prompts to Nano Banana / GPT-Image (stills) and
Kling / Veo / Grok (motion).

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
   animation prompt in the same pass. Clip length = the beat's real spoken
   seconds rounded **up to a whole second** (Kling-friendly), capped at a max
   you set (default 10s).
5. Each scene card has its beat name, time range, integer clip length, and copy
   buttons for the image prompt (art-style preset appended) and animation
   prompt.

Projects are saved locally in your browser (metadata in `localStorage`, the mp3
in IndexedDB). Nothing is uploaded to a server besides the API calls.

## Setup

```bash
cp .env.example .env.local      # add your two API keys
npm install
npm run dev                     # http://localhost:3000
```

Required env vars (see `.env.example`):

- `ANTHROPIC_API_KEY` — script, visual bible, and scene cut/prompts.
- `ELEVENLABS_API_KEY` — voice list + timestamped voiceover.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Anthropic SDK ·
ElevenLabs REST.

Key modules:

- `src/lib/alignment.ts` — word timings from ElevenLabs character alignment.
- `src/lib/scenes.ts` — assembles the AI's chosen beats into contiguous scenes
  with exact timing (integer clip = `ceil(spoken seconds)`, capped at the max).
- `src/lib/anthropic.ts` / `src/lib/prompts.ts` — structured story generation
  and the single cut-and-prompt pass (AI picks beats from the timestamped
  narration and writes each beat's prompts).
- `src/lib/scriptStyles.ts` — writing-style presets (the system prompt Claude
  adopts) + shared safety guardrails.
- `src/lib/styles.ts` — art-style presets, appended to every image prompt.
- `src/app/api/*` — `story`, `voices`, `tts`, `scenes` route handlers.

## Customizing

- **Writing styles** — add an entry to `SCRIPT_STYLES` in
  `src/lib/scriptStyles.ts`. Each carries its own `system` prompt. Ships with
  _Straight narrator_ (faithful) and _Recognition shorts_ (emotional-recognition
  persona). Both inherit the shared `SAFETY` guardrails.
- **Art styles** — add an entry to `ART_STYLES` in `src/lib/styles.ts`. Its
  `prompt` string is appended to every scene's image prompt at copy time, so
  switching styles never re-calls the AI.
- **Max clip length** — per project, set with the stepper in the Studio
  (default `DEFAULT_MAX_CLIP_SECONDS` in `src/lib/types.ts`).

## Scripts

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build (also typechecks)
npm run lint     # eslint
```
