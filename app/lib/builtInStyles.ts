import type { StoredStyle } from "~/types";

export const BUILT_IN_STYLES: StoredStyle[] = [
  {
    id: "cinematic",
    name: "Cinematic",
    enabled: true,
    text: "Cinematic film still, anamorphic lens, shallow depth of field, dramatic key light with deep shadows, subtle film grain, color-graded teal and amber, photographed on 35mm.",
  },
  {
    id: "vibrant",
    name: "Vibrant",
    enabled: true,
    text: "Bold saturated colors, high contrast, punchy lighting, vivid complementary palette, crisp edges, energetic and graphic.",
  },
  {
    id: "photorealistic",
    name: "Photorealistic",
    enabled: true,
    text: "Hyper-realistic photograph, natural lighting, accurate skin tones and materials, full-frame DSLR, 50mm lens, sharp focus, no stylization.",
  },
  {
    id: "anime",
    name: "Anime",
    enabled: true,
    text: "Modern anime illustration, clean line art, cel shading, expressive eyes, vibrant flat colors with soft gradients, studio-quality key visual.",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    enabled: true,
    text: "Minimalist composition, generous negative space, restrained palette of two or three muted tones, simple geometric shapes, clean and serene.",
  },
];

export function mergeWithBuiltInStyles(styles?: StoredStyle[]): StoredStyle[] {
  if (!styles || styles.length === 0) {
    return BUILT_IN_STYLES.map((style) => ({ ...style }));
  }

  const existingById = new Map(styles.map((style) => [style.id, style]));

  const mergedBuiltIns = BUILT_IN_STYLES.map((builtIn) => {
    const existing = existingById.get(builtIn.id);
    if (!existing) return { ...builtIn };
    return { ...builtIn, enabled: existing.enabled };
  });

  const customStyles = styles.filter((style) => style.isCustom);

  return [...mergedBuiltIns, ...customStyles];
}
