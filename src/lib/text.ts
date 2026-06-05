// Small text helpers shared across the UI.

export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/** Rough spoken length before a real voiceover exists (~150 wpm). */
export function estSeconds(text: string, wpm = 150): number {
  return Math.round((countWords(text) / wpm) * 60);
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatClock(seconds: number): string {
  const total = Math.round(seconds * 10) / 10;
  return `${total.toFixed(1)}s`;
}

/** Compact USD: more precision for tiny amounts, 2 decimals once it's ≥ $1. */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
