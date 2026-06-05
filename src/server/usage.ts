// Server-side helper: price a token-usage block and log it. Centralizes the
// pricing+insert so route handlers stay thin, and swallows errors so cost
// logging can never break the user's request.

import { recordUsage } from "./db";
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
