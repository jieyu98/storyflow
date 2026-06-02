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

1. **Paste** a Reddit story on the home page and pick an art style.
2. Claude rewrites it into a tight ≥60s narration and a **visual bible**
   (recurring characters + locations with fixed descriptions, so frames stay
   consistent).
3. In the **Studio**, pick one of your ElevenLabs voices and generate a
   timestamped voiceover.
4. Choose which clip lengths are allowed (**4 / 6 / 8 / 10s** — any subset).
   StoryFlow cuts the narration into scenes deterministically from the
   timestamps, snapping to sentence boundaries.
5. Generate per-scene prompts. Each scene card has a copy button for its image
   prompt (with the art-style preset appended) and its animation prompt.

Projects are saved locally in your browser (metadata in `localStorage`, the mp3
in IndexedDB). Nothing is uploaded to a server besides the API calls.

## Setup

```bash
cp .env.example .env.local      # add your two API keys
npm install --cache "$(pwd)/.npm-cache"
npm run dev                     # http://localhost:3000
```

Required env vars (see `.env.example`):

- `ANTHROPIC_API_KEY` — script, visual bible, and scene prompts.
- `ELEVENLABS_API_KEY` — voice list + timestamped voiceover.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind v4 · Anthropic SDK ·
ElevenLabs REST.

Key modules:

- `src/lib/alignment.ts` — word timings from ElevenLabs character alignment.
- `src/lib/scenes.ts` — deterministic scene cutting (timestamps are
  authoritative; AI never picks cut points).
- `src/lib/anthropic.ts` / `src/lib/prompts.ts` — structured story + scene
  prompt generation.
- `src/lib/styles.ts` — art-style presets, appended to every image prompt.
- `src/app/api/*` — `story`, `voices`, `tts`, `scenes` route handlers.

## Adding an art style

Add one entry to `ART_STYLES` in `src/lib/styles.ts` — its `prompt` string is
appended to every scene's image prompt.
