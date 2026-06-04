// Per-scene production recipe. For each scene it spells out how to make the
// STILL (and whether to attach a reference image for consistency) and how to turn
// it into a CLIP (which Grok mode). Derived deterministically from the scene data
// — entities present, first vs. repeat appearance, clamped length, and the
// neighbouring scene — so it stays reliable rather than guessed by the model.

import type { Scene, VisualBible } from "./types";

export type SceneRecipe = {
  /** Short badge for the video method, e.g. "Image → video", "Extend clip". */
  method: string;
  /** Numbered, human-readable steps for producing this scene. */
  steps: string[];
};

function uniq(a: string[]): string[] {
  return Array.from(new Set(a));
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

function entityIds(s: Scene): string[] {
  return uniq([...(s.characterIds ?? []), ...(s.locationIds ?? [])]);
}

export function buildSceneRecipes(
  scenes: Scene[],
  bible: VisualBible,
): SceneRecipe[] {
  const nameOf = (id: string) =>
    bible.characters.find((c) => c.id === id)?.name ??
    bible.locations.find((l) => l.id === id)?.name ??
    id;

  const seen = new Set<string>();
  let seenConcept = false;

  return scenes.map((s, i) => {
    const ids = entityIds(s);
    const fresh = ids.filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));

    const prev = scenes[i - 1];
    const isConcept = s.visualMode === "concept";
    const continuesPrev =
      !isConcept &&
      prev !== undefined &&
      prev.visualMode !== "concept" &&
      sameSet(ids, entityIds(prev));

    const steps: string[] = [];

    /* ---- still step: generate the starting frame (+ reference image?) ---- */
    if (isConcept) {
      steps.push("Generate the diagram from the image prompt below.");
      if (seenConcept) {
        steps.push(
          "Attach your first diagram as a style reference so the graphics all match.",
        );
      }
      seenConcept = true;
    } else if (ids.length > 0) {
      const names = ids.map(nameOf).join(", ");
      steps.push(
        `Generate the starting frame from the image prompt — UPLOAD the reference image for ${names} so it stays identical to other scenes.`,
      );
      if (fresh.length > 0) {
        steps.push(
          `${fresh.map(nameOf).join(", ")} appears for the first time here — generate its reference from the Visual bible first, then use it.`,
        );
      }
    } else {
      steps.push("Generate the starting frame from the image prompt below.");
    }

    /* ---- clip step: which Grok mode turns the still into video ---- */
    let method: string;
    if (s.clamped) {
      const full = Math.ceil(s.span);
      const extendBy = full - s.assignedDuration;
      method = "Image → video / extend";
      steps.push(
        `This beat runs ${full}s — over the ${s.assignedDuration}s maximum single clip. Split it into two beats, or generate a ${s.assignedDuration}s clip and EXTEND it +${extendBy}s (last-frame → video) to cover the rest.`,
      );
    } else if (continuesPrev) {
      method = "Image → video / extend";
      steps.push(
        "Animate with the animation prompt — or, only if this is genuinely one continuous take with the previous shot, EXTEND the previous clip instead of cutting.",
      );
    } else {
      method = "Image → video";
      steps.push("Animate the still with the animation prompt (image → video).");
    }

    return { method, steps };
  });
}
