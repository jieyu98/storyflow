import { type Scene, type Word } from "./types";

/** One AI-chosen beat, identified by the word index it ends on, plus its prompts. */
export type SceneBeat = {
  endWord: number;
  name?: string;
  imagePrompt?: string;
  animationPrompt?: string;
  characterIds?: string[];
};

/** Numbered word list with cumulative end-times, fed to the beat-cutting prompt. */
export function numberedWords(words: Word[]): string {
  return words.map((w, i) => `[${i}] ${w.text} (${w.end.toFixed(1)}s)`).join(" ");
}

/** Integer clip length that always covers the speech, capped at the max. */
function clipSeconds(span: number, maxSeconds: number): number {
  return Math.min(Math.ceil(span - 0.001), maxSeconds);
}

function makeScene(
  words: Word[],
  index: number,
  start: number,
  end: number,
  maxSeconds: number,
  beat: Partial<SceneBeat>,
): Scene {
  const tStart = words[start].start;
  const tSpokenEnd = words[end].end;
  const span = tSpokenEnd - tStart;
  return {
    index,
    startWord: start,
    endWord: end,
    tStart,
    tSpokenEnd,
    span,
    assignedDuration: clipSeconds(span, maxSeconds),
    clamped: span > maxSeconds + 0.05,
    text: words
      .slice(start, end + 1)
      .map((w) => w.text)
      .join(" "),
    name: beat.name,
    imagePrompt: beat.imagePrompt,
    animationPrompt: beat.animationPrompt,
    characterIds: beat.characterIds,
  };
}

/**
 * Turn the AI's ordered beats (each marking the word it ends on) into contiguous
 * scenes with EXACT timing read from the word timestamps. Robust to minor index
 * slips: ranges are forced contiguous and the final scene always reaches the end.
 */
export function buildScenesFromBeats(
  words: Word[],
  beats: SceneBeat[],
  maxSeconds: number,
): Scene[] {
  if (words.length === 0) return [];
  const last = words.length - 1;
  const ordered = [...beats].sort((a, b) => a.endWord - b.endWord);

  const scenes: Scene[] = [];
  let start = 0;
  for (const beat of ordered) {
    if (start > last) break;
    const raw = Math.round(beat.endWord);
    if (!Number.isFinite(raw)) continue;
    const end = Math.max(start, Math.min(raw, last));
    scenes.push(makeScene(words, scenes.length, start, end, maxSeconds, beat));
    start = end + 1;
  }

  // Guarantee full coverage to the last word.
  if (start <= last) {
    if (scenes.length > 0) {
      const prev = scenes[scenes.length - 1];
      scenes[scenes.length - 1] = makeScene(
        words,
        prev.index,
        prev.startWord,
        last,
        maxSeconds,
        prev,
      );
    } else {
      scenes.push(makeScene(words, 0, 0, last, maxSeconds, {}));
    }
  }

  return scenes;
}

export type Coverage = {
  totalClip: number;
  totalSpoken: number;
  padding: number;
};

/** Clip timeline (sum of integer clip lengths) vs. the spoken timeline. */
export function sceneCoverage(scenes: Scene[]): Coverage {
  if (scenes.length === 0) return { totalClip: 0, totalSpoken: 0, padding: 0 };
  const totalClip = scenes.reduce((s, sc) => s + sc.assignedDuration, 0);
  const totalSpoken = scenes[scenes.length - 1].tSpokenEnd;
  return { totalClip, totalSpoken, padding: totalClip - totalSpoken };
}
