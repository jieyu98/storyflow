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
  /** Neutralized variant for REFERENCE images: same render medium as `prompt`,
   *  but the subject isolated on a plain grey background with even lighting — no
   *  environment, atmosphere, mood lighting, particles, or bokeh (those make a
   *  weaker consistency anchor). Falls back to `prompt` when absent. */
  referencePrompt?: string;
};

export const ART_STYLES: ArtStyle[] = [
  {
    id: "pixar-3d",
    name: "Pixar Campfire",
    tagline: "Warm cinematic 3D, emotive Pixar glow",
    prompt:
      "Rendered in the style of modern Pixar/Disney 3D animation: soft cinematic lighting with a warm amber key light and cool blue shadows. Highly detailed yet simplified, stylized geometry with painterly textures on fabric, surfaces and materials, and soft subsurface scattering where appropriate. Any characters present are stylized with soft rounded features and expressive, emotionally readable eyes; render only the subjects described above and add no people unless they are described. Shallow depth of field with a soft, gently blurred background that fits the described setting. Rich but natural color grading — warm oranges and ambers in the lit areas, deep blues in the shadows. Soft directional lighting, gentle rim lighting, a warm and emotionally honest cinematic mood — grown-up and sincere like a Pixar feature at its most poignant, never childish, cutesy, or saccharine. Do NOT add a literal campfire, embers, sparks, floating glowing particles, smoke, atmospheric haze, or an outdoor twilight sky unless the scene explicitly describes them — the background must match the scene's actual setting (an interior stays an interior). High polish, cinematic 3D render, octane/redshift quality.",
    referencePrompt:
      "Rendered in the style of modern Pixar/Disney 3D animation: stylized geometry with painterly textures on fabric, surfaces and materials, and soft subsurface scattering where appropriate. Any character is stylized with soft rounded features and expressive, emotionally readable eyes; render only the subject described above and add no people, props, or scenery unless described. Place the subject ALONE on a plain seamless light-grey studio background with soft, even, neutral lighting and sharp focus across the subject. Neutral balanced color — explicitly NO warm/cool grade, NO campfire glow, NO twilight, NO glowing particles, NO atmospheric haze, NO background bokeh, NO dramatic rim or volumetric lighting. High polish, clean 3D render, octane/redshift quality — a clean, reusable reference, not a cinematic shot.",
  },
  {
    id: "explainer-3d",
    name: "Clean Explainer 3D",
    tagline: "Bright, crisp product-viz — the object is the hero",
    prompt:
      "Rendered as bright, clean, polished 3D product visualization in the style of high-end commercial and keynote renders: a seamless, uncluttered studio background in a soft single color or subtle gradient, the key subject as a clear hero object well-separated from the background and reading instantly at thumbnail size. Soft, even, high-key studio lighting from large diffused sources with gentle soft shadows and clean contact shadows; no harsh glare, no murk. Crisp focus on the hero with only a hint of depth-of-field falloff, so detail stays legible. Smooth, slightly stylized geometry with realistic, tactile materials — accurate reflections, subtle subsurface scattering, fine surface detail (grain, weave, condensation) where it helps comprehension. Render only the subjects described above; add no extra people or props. Controlled, vivid but tasteful palette with one confident accent color; modern, trustworthy, premium. High polish, clean 3D render, octane/redshift quality.",
    referencePrompt:
      "Rendered as bright, clean, polished 3D product visualization: the subject as a single hero object isolated on a plain seamless light-grey studio background, well-separated and reading instantly. Soft, even, high-key studio lighting from large diffused sources with gentle soft shadows and clean contact shadows; no harsh glare, no murk. Crisp focus on the subject with realistic, tactile materials — accurate reflections, subtle subsurface scattering, fine surface detail where it helps. Render only the subject described above; add no extra people, props, scenery, or background elements. Neutral, clean, premium — no dramatic mood lighting, no atmosphere, no bokeh. High polish, clean 3D render, octane/redshift quality — a clean, reusable reference.",
  },
  {
    id: "documentary-real",
    name: "Documentary Realism",
    tagline: "Photoreal, natural light — maximum credibility",
    prompt:
      "Photographed as authentic, photorealistic documentary footage: real-world materials, true-to-life textures and imperfections, natural and practical lighting (soft window light, real interiors) with believable shadows and white balance. Shot like a modern mirrorless camera with a fast prime lens — natural shallow depth of field, gentle background blur, crisp focus on the subject, subtle film grain and realistic color. Render only the subjects described above; add no extra people or props, and keep recurring subjects consistent in appearance. Clean, unstaged, real — no CGI sheen, no illustration, no cartoon styling, no over-saturation. Credible, grounded, high-resolution photography.",
    referencePrompt:
      "Photographed as an authentic, photorealistic studio reference: the subject alone on a plain seamless light-grey backdrop under soft, even, neutral studio lighting with believable soft shadows and accurate white balance. Real-world materials, true-to-life textures and imperfections, sharp focus across the subject, shot like a modern mirrorless camera with a prime lens, subtle realistic film grain. Render only the subject described above; add no extra people, props, or environment. No dramatic lighting, no interior scene, no heavy background blur, no color cast, no CGI sheen, no illustration — clean, even, credible, high-resolution photography — a clean, reusable reference.",
  },
  {
    id: "infographic",
    name: "Explainer Graphics",
    tagline: "Flat 2.5D infographic — diagram-native, for tips",
    prompt:
      "Rendered as a clean, modern explainer infographic in a layered 2.5D motion-graphics style: bold flat shapes and confident geometry with subtle dimensional depth — soft long drop shadows, distinct layered planes, and smooth gradients so elements sit on separate planes for gentle parallax. Bright, friendly, high-contrast palette on a warm off-white background with one strong accent color. Crisp clean edges, generous negative space, clear visual hierarchy. Keep ALL content — graphics, icons, arrows AND any text — within the upper ~70% of the tall 9:16 frame; the bottom ~30% must be COMPLETELY EMPTY background, with no text, label, title, or caption of any kind in it (subtitles are overlaid there). Do NOT add a title banner or a descriptive caption sentence anywhere; use only short one-or-two-word inline labels placed beside the elements they mark, all in the upper area. Diagrams, cutaways, floating particles, icons and arrows are first-class elements. Render only the subjects described above; add no extra people or props. Minimal, uncluttered, premium editorial-explainer feel. No photorealism and no 3D-render-engine look.",
    referencePrompt:
      "Rendered as a clean, modern explainer-graphic reference in a layered 2.5D motion-graphics style: the subject as bold flat shapes with confident geometry and subtle dimensional depth (a soft long drop shadow, smooth gradients), isolated and centered on a plain flat light-grey background with generous negative space. Crisp clean edges, a bright friendly palette with one confident accent color. Render only the subject described above; add no extra people, props, scenery, arrows, icons, labels, or text. Minimal and uncluttered. No photorealism and no 3D-render-engine look — a clean, reusable reference.",
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
  return `${framing} ${entity.visualDescription.trim()} Plain neutral light-grey background, even soft lighting, sharp focus — a clean, reusable reference, not a dramatic or stylized shot.\n\nStyle: ${style.referencePrompt ?? style.prompt}`;
}
