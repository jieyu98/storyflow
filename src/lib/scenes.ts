import { type Scene, type Word } from "./types";

/** One AI-chosen beat, identified by the word index it ends on, plus its prompts. */
export type SceneBeat = {
  endWord: number;
  name?: string;
  imagePrompt?: string;
  animationPrompt?: string;
  characterIds?: string[];
  locationIds?: string[];
  visualMode?: "live" | "concept";
};

/** Numbered word list with cumulative end-times, fed to the beat-cutting prompt. */
export function numberedWords(words: Word[]): string {
  return words.map((w, i) => `[${i}] ${w.text} (${w.end.toFixed(1)}s)`).join(" ");
}

/** Integer clip length that always covers the time slot, capped at the max. */
function clipSeconds(slot: number, maxSeconds: number): number {
  return Math.min(Math.ceil(slot - 0.001), maxSeconds);
}

type Range = { start: number; end: number; beat: Partial<SceneBeat> };

/**
 * Turn the AI's ordered beats (each marking the word it ends on) into contiguous
 * scenes. Timing uses CONTIGUOUS TIME SLICES so the clips tile the whole
 * voiceover: each scene runs from where it starts to where the NEXT scene starts
 * (the last scene to the audio end), so the silent pauses between beats are kept,
 * not dropped. Clip length = ceil(slot), capped at the max.
 *
 * Robust to bad AI indices: ranges are forced contiguous and the final scene
 * always reaches the last word.
 */
export function buildScenesFromBeats(
  words: Word[],
  beats: SceneBeat[],
  maxSeconds: number,
): Scene[] {
  if (words.length === 0) return [];
  const last = words.length - 1;
  const audioEnd = words[last].end;

  // Pass 1 — contiguous word ranges from the AI's cut points.
  const ordered = [...beats].sort((a, b) => a.endWord - b.endWord);
  const ranges: Range[] = [];
  let start = 0;
  for (const beat of ordered) {
    if (start > last) break;
    const raw = Math.round(beat.endWord);
    if (!Number.isFinite(raw)) continue;
    const end = Math.max(start, Math.min(raw, last));
    ranges.push({ start, end, beat });
    start = end + 1;
  }
  if (start <= last) {
    if (ranges.length > 0) ranges[ranges.length - 1].end = last;
    else ranges.push({ start: 0, end: last, beat: {} });
  }

  // Pass 2 — contiguous time slices. Scene i spans [sliceStart_i, sliceStart_{i+1}],
  // with the first scene starting at 0 and the last ending at the audio end.
  return ranges.map((r, i) => {
    const sliceStart = i === 0 ? 0 : words[r.start].start;
    const sliceEnd =
      i === ranges.length - 1 ? audioEnd : words[ranges[i + 1].start].start;
    const slot = Math.max(0, sliceEnd - sliceStart);
    return {
      index: i,
      startWord: r.start,
      endWord: r.end,
      tStart: sliceStart,
      tSpokenEnd: sliceEnd,
      span: slot,
      assignedDuration: clipSeconds(slot, maxSeconds),
      clamped: slot > maxSeconds + 0.05,
      text: words
        .slice(r.start, r.end + 1)
        .map((w) => w.text)
        .join(" "),
      name: r.beat.name,
      imagePrompt: r.beat.imagePrompt,
      animationPrompt: r.beat.animationPrompt,
      characterIds: r.beat.characterIds,
      locationIds: r.beat.locationIds,
      visualMode: r.beat.visualMode,
    };
  });
}

export type Coverage = {
  totalClip: number;
  totalSpoken: number;
  padding: number;
};

/** Sum of integer clip lengths vs. the full voiceover length. */
export function sceneCoverage(scenes: Scene[]): Coverage {
  if (scenes.length === 0) return { totalClip: 0, totalSpoken: 0, padding: 0 };
  const totalClip = scenes.reduce((s, sc) => s + sc.assignedDuration, 0);
  const totalSpoken = scenes[scenes.length - 1].tSpokenEnd;
  return { totalClip, totalSpoken, padding: totalClip - totalSpoken };
}
