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
};

/** Model used for story + scene-prompt generation. */
export const ANTHROPIC_MODEL = "claude-sonnet-4-6";
