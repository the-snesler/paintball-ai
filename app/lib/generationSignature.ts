import type { AspectRatio, ReferenceImage, Resolution } from "~/types";

interface GenerationSignatureInput {
  prompt: string;
  modelSelections: Record<string, number>;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  referenceImages: ReferenceImage[];
}

export function buildGenerationSignature(input: GenerationSignatureInput): string {
  const normalizedSelections = Object.entries(input.modelSelections)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  const normalizedReferenceIds = input.referenceImages.map((image) => image.id).sort();

  return JSON.stringify({
    prompt: input.prompt.trim(),
    selections: normalizedSelections,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    referenceImageIds: normalizedReferenceIds,
  });
}
