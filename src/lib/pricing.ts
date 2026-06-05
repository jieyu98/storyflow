// Token-usage cost estimation. Pure logic, no secrets — unit-testable.
//
// Rates are USD per MILLION tokens; edit when Anthropic pricing changes.
// Prompt caching (the app uses 5-minute "ephemeral" cache on system prompts):
//   • cache WRITE (cache_creation_input_tokens) = 1.25× the input rate
//   • cache READ  (cache_read_input_tokens)     = 0.10× the input rate

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Tokens written to the prompt cache (cache_creation_input_tokens). */
  cacheWriteTokens: number;
  /** Tokens served from the prompt cache (cache_read_input_tokens). */
  cacheReadTokens: number;
};

type Rate = { input: number; output: number };

/** USD per million tokens, by Anthropic model id. */
const ANTHROPIC_RATES: Record<string, Rate> = {
  "claude-opus-4-8": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

const CACHE_WRITE_MULT = 1.25; // 5-minute ephemeral cache write
const CACHE_READ_MULT = 0.1; // cache hit

/** Estimated USD cost of one Anthropic call. Unknown models fall back to Sonnet. */
export function anthropicCost(model: string, u: TokenUsage): number {
  const r = ANTHROPIC_RATES[model] ?? ANTHROPIC_RATES["claude-sonnet-4-6"];
  return (
    (u.inputTokens * r.input +
      u.outputTokens * r.output +
      u.cacheWriteTokens * r.input * CACHE_WRITE_MULT +
      u.cacheReadTokens * r.input * CACHE_READ_MULT) /
    1_000_000
  );
}
