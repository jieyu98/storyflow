// Art-style presets. The `prompt` string is appended to every scene's image
// prompt at display/copy time, so switching styles never requires re-calling AI.
// Add a new style = add one entry here.

export type ArtStyle = {
  id: string;
  name: string;
  /** Short human label shown in the picker. */
  tagline: string;
  /** Appended verbatim to each scene's image prompt. */
  prompt: string;
};

export const ART_STYLES: ArtStyle[] = [
  {
    id: "pixar-3d",
    name: "Pixar Campfire",
    tagline: "Warm cinematic 3D, emotive Pixar glow",
    prompt:
      "Rendered in the style of modern Pixar/Disney 3D animation: soft cinematic lighting, warm campfire glow against cool blue twilight. Highly detailed yet simplified, stylized geometry with painterly textures on fabric, surfaces and materials, and soft subsurface scattering where appropriate. Any characters present are stylized with soft rounded features and expressive, emotionally readable eyes; render only the subjects described above and add no people unless they are described. Shallow depth of field with soft bokeh background, atmospheric haze, glowing particles. Rich color grading: warm oranges and ambers in the foreground, deep navy and purple blues in the background. Volumetric lighting, gentle rim lighting, warm and emotionally honest cinematic mood — grown-up and sincere like a Pixar feature at its most poignant, never childish, cutesy, or saccharine. High polish, cinematic 3D render, octane/redshift quality.",
  },
  {
    id: "explainer-3d",
    name: "Clean Explainer 3D",
    tagline: "Bright, crisp product-viz — the object is the hero",
    prompt:
      "Rendered as bright, clean, polished 3D product visualization in the style of high-end commercial and keynote renders: a seamless, uncluttered studio background in a soft single color or subtle gradient, the key subject as a clear hero object well-separated from the background and reading instantly at thumbnail size. Soft, even, high-key studio lighting from large diffused sources with gentle soft shadows and clean contact shadows; no harsh glare, no murk. Crisp focus on the hero with only a hint of depth-of-field falloff, so detail stays legible. Smooth, slightly stylized geometry with realistic, tactile materials — accurate reflections, subtle subsurface scattering, fine surface detail (grain, weave, condensation) where it helps comprehension. Render only the subjects described above; add no extra people or props. Controlled, vivid but tasteful palette with one confident accent color; modern, trustworthy, premium. High polish, clean 3D render, octane/redshift quality.",
  },
  {
    id: "documentary-real",
    name: "Documentary Realism",
    tagline: "Photoreal, natural light — maximum credibility",
    prompt:
      "Photographed as authentic, photorealistic documentary footage: real-world materials, true-to-life textures and imperfections, natural and practical lighting (soft window light, real interiors) with believable shadows and white balance. Shot like a modern mirrorless camera with a fast prime lens — natural shallow depth of field, gentle background blur, crisp focus on the subject, subtle film grain and realistic color. Render only the subjects described above; add no extra people or props, and keep recurring subjects consistent in appearance. Clean, unstaged, real — no CGI sheen, no illustration, no cartoon styling, no over-saturation. Credible, grounded, high-resolution photography.",
  },
  {
    id: "infographic",
    name: "Explainer Graphics",
    tagline: "Flat 2.5D infographic — diagram-native, for tips",
    prompt:
      "Rendered as a clean, modern explainer infographic in a layered 2.5D motion-graphics style: bold flat shapes and confident geometry with subtle dimensional depth — soft long drop shadows, distinct layered planes, and smooth gradients so elements sit on separate planes for gentle parallax. Bright, friendly, high-contrast palette on a warm off-white background with one strong accent color. Crisp clean edges, generous negative space, clear visual hierarchy. Keep ALL content — graphics, icons, arrows AND any text — within the upper ~70% of the tall 9:16 frame; the bottom ~30% must be COMPLETELY EMPTY background, with no text, label, title, or caption of any kind in it (subtitles are overlaid there). Do NOT add a title banner or a descriptive caption sentence anywhere; use only short one-or-two-word inline labels placed beside the elements they mark, all in the upper area. Diagrams, cutaways, floating particles, icons and arrows are first-class elements. Render only the subjects described above; add no extra people or props. Minimal, uncluttered, premium editorial-explainer feel. No photorealism and no 3D-render-engine look.",
  },
];

export const DEFAULT_STYLE_ID = ART_STYLES[0].id;

export function getStyle(id: string | undefined): ArtStyle {
  return ART_STYLES.find((s) => s.id === id) ?? ART_STYLES[0];
}

/** Compose the final image prompt a user copies: scene description + style preset. */
export function composeImagePrompt(
  base: string | undefined,
  styleId: string,
): string {
  const style = getStyle(styleId);
  const desc = (base ?? "").trim();
  if (!desc) return style.prompt;
  return `${desc}\n\nStyle: ${style.prompt}`;
}

/** Pick the art style for a scene: "concept" scenes use the concept style when set. */
export function styleForScene(
  scene: { visualMode?: "live" | "concept" },
  primaryId: string,
  conceptId?: string,
): string {
  return scene.visualMode === "concept" && conceptId ? conceptId : primaryId;
}

/**
 * A canonical "reference image" prompt for a bible entity. Generate this ONCE,
 * then reuse the resulting image as a reference in every scene the entity appears
 * in — that is what keeps a character or object identical across separately
 * generated frames (cross-shot consistency).
 */
export function composeReferencePrompt(
  entity: { name: string; visualDescription: string },
  styleId: string,
  kind: "character" | "location",
): string {
  const style = getStyle(styleId);
  const framing =
    kind === "character"
      ? `Character reference sheet of ${entity.name}: a single clear full-figure portrait, front view, neutral pose and neutral expression, the entire figure visible, no props and no scene around them.`
      : `Reference image of ${entity.name}: the subject centered and fully visible in a single clean establishing view, no extra elements or background clutter.`;
  return `${framing} ${entity.visualDescription.trim()} Plain neutral light-grey background, even soft lighting, sharp focus — a clean, reusable reference, not a dramatic or stylized shot.\n\nStyle: ${style.prompt}`;
}
