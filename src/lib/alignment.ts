import type { AlignmentArrays, Word } from "./types";

/**
 * Reconstruct word-level timings from ElevenLabs character-level alignment.
 * Walks the parallel character arrays, accumulating non-whitespace characters
 * into tokens. Trailing punctuation stays attached (needed for boundary
 * detection during scene cutting).
 */
export function wordsFromAlignment(alignment: AlignmentArrays): Word[] {
  const { characters, character_start_times_seconds, character_end_times_seconds } =
    alignment;
  const words: Word[] = [];

  let buf = "";
  let wordStart: number | null = null;
  let lastCharEnd = 0;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    const start = character_start_times_seconds[i] ?? lastCharEnd;
    const end = character_end_times_seconds[i] ?? start;

    if (/\s/.test(ch)) {
      if (buf !== "" && wordStart !== null) {
        words.push({ text: buf, start: wordStart, end: lastCharEnd });
      }
      buf = "";
      wordStart = null;
    } else {
      if (buf === "") wordStart = start;
      buf += ch;
      lastCharEnd = end;
    }
  }

  if (buf !== "" && wordStart !== null) {
    words.push({ text: buf, start: wordStart, end: lastCharEnd });
  }

  return words;
}

/** Total spoken length in seconds = end time of the last word. */
export function audioDurationFromWords(words: Word[]): number {
  if (words.length === 0) return 0;
  return words[words.length - 1].end;
}
