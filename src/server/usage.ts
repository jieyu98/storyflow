// Server-side helper: price a token-usage block and log it. Centralizes the
// pricing+insert so route handlers stay thin, and swallows errors so cost
// logging can never break the user's request.

import { recordUsage } from "./db";
import { GROK_VIDEO_MODEL } from "./env";
import { anthropicCost, type TokenUsage } from "@/lib/pricing";

export function recordAnthropicUsage(args: {
  projectId?: string | null;
  operation: string;
  model: string;
  usage: TokenUsage;
}): void {
  try {
    recordUsage({
      projectId: args.projectId ?? null,
      provider: "anthropic",
      model: args.model,
      operation: args.operation,
      inputTokens: args.usage.inputTokens,
      outputTokens: args.usage.outputTokens,
      cacheWriteTokens: args.usage.cacheWriteTokens,
      cacheReadTokens: args.usage.cacheReadTokens,
      costUsd: anthropicCost(args.model, args.usage),
    });
  } catch {
    // Best-effort: never let cost logging fail the request.
  }
}

/**
 * Record Grok video spend. The Batch API returns a pre-priced cost per clip (in
 * "ticks" = 1e-10 USD), so there's no rate table — just convert and log.
 */
export function recordGrokBatchUsage(args: {
  projectId?: string | null;
  costUsd: number;
}): void {
  try {
    recordUsage({
      projectId: args.projectId ?? null,
      provider: "grok",
      model: GROK_VIDEO_MODEL,
      operation: "clip-batch",
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      costUsd: args.costUsd,
    });
  } catch {
    // Best-effort: never let cost logging fail the request.
  }
}
