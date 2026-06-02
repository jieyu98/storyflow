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
    tagline: "Warm cinematic 3D, cozy storybook glow",
    prompt:
      "3D rendered animation in the style of modern Pixar/Disney films, soft cinematic lighting, warm campfire glow against cool blue twilight. Stylized cartoon character with large expressive eyes, rounded soft facial features, smooth subsurface-scattering skin, rosy cheeks. Highly detailed yet simplified geometry, painterly textures on fabric and fur. Shallow depth of field with soft bokeh background, atmospheric haze, glowing particles. Rich color grading: warm oranges and ambers in foreground, deep navy and purple blues in background. Volumetric lighting, gentle rim lighting on subjects, cozy storybook mood. High polish, family-friendly, cinematic 3D render, octane/redshift quality.",
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
