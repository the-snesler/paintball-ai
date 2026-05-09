import type { AspectRatio, ReferenceImage, Resolution } from "~/types";

interface GenerationSignatureInput {
  prompt: string;
  modelSelections: Record<string, number>;
  aspectRatio: AspectRatio | null;
  resolution: Resolution;
  quality: string | null;
  numberOfImages: number;
  referenceImages: ReferenceImage[];
  styleId?: string | null;
  characterIds?: string[];
}

export function buildGenerationSignature(input: GenerationSignatureInput): string {
  const normalizedSelections = Object.entries(input.modelSelections)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const normalizedReferenceIds = input.referenceImages.map((image) => image.id).sort();
  const normalizedCharacterIds = [...(input.characterIds ?? [])].sort();

  return JSON.stringify({
    prompt: input.prompt.trim(),
    selections: normalizedSelections,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    quality: input.quality,
    numberOfImages: input.numberOfImages,
    referenceImageIds: normalizedReferenceIds,
    styleId: input.styleId ?? null,
    characterIds: normalizedCharacterIds,
  });
}
