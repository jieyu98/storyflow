// Typed, lazy access to server-only secrets. Getters throw only when accessed
// (at request time), so the app still builds without keys present.

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (see .env.example).`,
    );
  }
  return value.trim();
}

export const serverEnv = {
  get ANTHROPIC_API_KEY(): string {
    return required("ANTHROPIC_API_KEY");
  },
  get ELEVENLABS_API_KEY(): string {
    return required("ELEVENLABS_API_KEY");
  },
  /** Google AI Studio key for Gemini image generation ("Nano Banana"). */
  get GEMINI_API_KEY(): string {
    return required("GEMINI_API_KEY");
  },
  /** xAI key for Grok image-to-video generation ("Grok Imagine"). */
  get XAI_API_KEY(): string {
    return required("XAI_API_KEY");
  },
};

/** Model used for story + scene-prompt generation. */
export const ANTHROPIC_MODEL = "claude-sonnet-4-6";

/**
 * Gemini image model for in-app generation.
 *   "gemini-3-pro-image"   — Nano Banana Pro: best text + reference consistency.
 *   "gemini-3.1-flash-image" — Nano Banana 2 (Flash): cheaper / faster.
 *   "gemini-2.5-flash-image" — original Nano Banana.
 */
export const GEMINI_IMAGE_MODEL = "gemini-3-pro-image";

/** Grok image-to-video model ("Grok Imagine"). */
export const GROK_VIDEO_MODEL = "grok-imagine-video";
