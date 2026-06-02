import { ALL_DURATIONS, type Duration, type Scene, type Word } from "./types";

// Trailing punctuation that ends a sentence vs. a softer clause break.
const SENTENCE_END = /[.!?…]["'”’)\]]?$/;
const CLAUSE_END = /[,;:—–]["'”’)\]]?$/;

function isSentenceEnd(word: Word): boolean {
  return SENTENCE_END.test(word.text);
}

function isClauseEnd(word: Word): boolean {
  return CLAUSE_END.test(word.text);
}

/** Sort, de-dupe and validate the allowed set; fall back to all four. */
export function normalizeAllowed(allowed: Duration[]): Duration[] {
  const valid = ALL_DURATIONS.filter((d) => allowed.includes(d));
  const set = valid.length > 0 ? valid : ALL_DURATIONS;
  return [...set].sort((a, b) => a - b);
}

/** Smallest allowed clip length that covers the spoken span; else the largest. */
export function chooseDuration(span: number, allowed: Duration[]): Duration {
  for (const d of allowed) {
    if (d >= span - 0.001) return d;
  }
  return allowed[allowed.length - 1];
}

/** Latest index in (from..to] where predicate holds, or -1. */
function lastIndexWhere(
  words: Word[],
  from: number,
  to: number,
  pred: (w: Word) => boolean,
): number {
  for (let i = to; i > from; i--) {
    if (pred(words[i])) return i;
  }
  // Allow a boundary exactly at `from` only when it's a single-word window.
  if (from === to && pred(words[from])) return from;
  return -1;
}

function joinWords(words: Word[], from: number, to: number): string {
  return words
    .slice(from, to + 1)
    .map((w) => w.text)
    .join(" ");
}

/**
 * Deterministically partition narration words into contiguous scenes. Each
 * scene is assigned a clip length from `allowed`; breaks prefer sentence ends,
 * then clause ends, then a hard word boundary. Timestamps are authoritative —
 * no AI is involved in choosing cut points.
 */
export function cutScenes(words: Word[], allowedRaw: Duration[]): Scene[] {
  const allowed = normalizeAllowed(allowedRaw);
  const dMax = allowed[allowed.length - 1];
  const dMin = allowed[0];
  const scenes: Scene[] = [];

  let s = 0;
  while (s < words.length) {
    const sceneStart = words[s].start;

    // Furthest word that still fits within the largest allowed duration.
    let e = s;
    while (e + 1 < words.length && words[e + 1].end - sceneStart <= dMax) {
      e++;
    }

    let cutAt: number;
    let softCut = false;
    let overflow = false;

    if (e === s && words[s].end - sceneStart > dMax) {
      // A single word longer than the largest clip — take it alone.
      cutAt = s;
      overflow = true;
    } else {
      const sentenceCut = lastIndexWhere(words, s, e, isSentenceEnd);
      if (sentenceCut !== -1) {
        cutAt = sentenceCut;
      } else {
        const clauseCut = lastIndexWhere(words, s, e, isClauseEnd);
        if (clauseCut !== -1) {
          cutAt = clauseCut;
          softCut = true;
        } else {
          cutAt = e;
          softCut = true;
        }
      }
    }

    const span = words[cutAt].end - sceneStart;
    scenes.push({
      index: scenes.length,
      startWord: s,
      endWord: cutAt,
      tStart: sceneStart,
      tSpokenEnd: words[cutAt].end,
      span,
      assignedDuration: chooseDuration(span, allowed),
      text: joinWords(words, s, cutAt),
      softCut,
      overflow,
    });

    s = cutAt + 1;
  }

  // Merge a stubby final scene into the previous one when it stays within dMax.
  if (scenes.length >= 2) {
    const last = scenes[scenes.length - 1];
    const prev = scenes[scenes.length - 2];
    const mergedSpan = last.tSpokenEnd - prev.tStart;
    if (last.span < dMin && mergedSpan <= dMax) {
      scenes.pop();
      scenes[scenes.length - 1] = {
        ...prev,
        endWord: last.endWord,
        tSpokenEnd: last.tSpokenEnd,
        span: mergedSpan,
        assignedDuration: chooseDuration(mergedSpan, allowed),
        text: `${prev.text} ${last.text}`,
        softCut: last.softCut,
        overflow: prev.overflow || last.overflow,
      };
    }
  }

  return scenes;
}

export type Coverage = {
  totalClip: number;
  totalSpoken: number;
  padding: number;
};

/** Clip timeline (sum of assigned durations) vs. the spoken timeline. */
export function sceneCoverage(scenes: Scene[]): Coverage {
  if (scenes.length === 0) return { totalClip: 0, totalSpoken: 0, padding: 0 };
  const totalClip = scenes.reduce((sum, sc) => sum + sc.assignedDuration, 0);
  const totalSpoken = scenes[scenes.length - 1].tSpokenEnd;
  return { totalClip, totalSpoken, padding: totalClip - totalSpoken };
}
