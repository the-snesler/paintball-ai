import type { AspectRatio, StoredModel } from "~/types";

export const ASPECT_RATIOS: { value: AspectRatio; label: string; width: number; height: number }[] =
  [
    { value: "1:1", label: "1:1", width: 1, height: 1 },
    { value: "16:9", label: "16:9", width: 16, height: 9 },
    { value: "9:16", label: "9:16", width: 9, height: 16 },
    { value: "4:3", label: "4:3", width: 4, height: 3 },
    { value: "3:4", label: "3:4", width: 3, height: 4 },
    { value: "21:9", label: "21:9", width: 21, height: 9 },
  ];

const PRIMARY_ASPECT_RATIO_VALUES = ASPECT_RATIOS.map((ratio) => ratio.value);

export const RESOLUTIONS = ["1K", "2K", "4K"] as const;

export const QUALITIES = ["low", "medium", "high", "auto"] as const;
export type Quality = (typeof QUALITIES)[number];

// Helper to get a model by ID from a models array
export function getModel(models: StoredModel[], modelId: string): StoredModel | undefined {
  return models.find((m) => m.id === modelId);
}

// Helper to check if any selected model supports aspect ratios
export function anyModelSupportsAspectRatio(
  models: StoredModel[],
  selectedModelIds: string[]
): boolean {
  return getAspectRatioIntersection(models, selectedModelIds).length > 0;
}

function getSupportedAspectRatiosForModel(model: StoredModel): string[] {
  if (!model.capabilities.supportsAspectRatios) {
    return [];
  }

  if (
    Array.isArray(model.capabilities.supportedAspectRatios) &&
    model.capabilities.supportedAspectRatios.length > 0
  ) {
    return model.capabilities.supportedAspectRatios;
  }

  // Fallback for un-migrated models or schemas with unknown enum values.
  return PRIMARY_ASPECT_RATIO_VALUES;
}

export function parseAspectRatio(ratio: string): { width: number; height: number } {
  const [w, h] = ratio.split(":");
  const width = Number(w);
  const height = Number(h);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }

  return { width, height };
}

export function getAspectRatioIntersection(
  models: StoredModel[],
  selectedModelIds: string[]
): string[] {
  if (selectedModelIds.length === 0) {
    return PRIMARY_ASPECT_RATIO_VALUES;
  }

  let intersection: Set<string> | null = null;

  for (const modelId of selectedModelIds) {
    const model = getModel(models, modelId);
    if (!model) continue;

    const modelRatios = getSupportedAspectRatiosForModel(model);
    if (modelRatios.length === 0) {
      return [];
    }

    const modelSet = new Set(modelRatios);
    if (!intersection) {
      intersection = modelSet;
      continue;
    }

    intersection = new Set([...intersection].filter((ratio) => modelSet.has(ratio)));
  }

  return intersection ? [...intersection] : [];
}

export function getAspectRatioUnion(models: StoredModel[], selectedModelIds: string[]): string[] {
  if (selectedModelIds.length === 0) {
    return PRIMARY_ASPECT_RATIO_VALUES;
  }

  const ratioSet = new Set<string>();

  for (const modelId of selectedModelIds) {
    const model = getModel(models, modelId);
    if (!model) continue;

    for (const ratio of getSupportedAspectRatiosForModel(model)) {
      ratioSet.add(ratio);
    }
  }

  return [...ratioSet];
}

// Helper to check if any selected model supports resolution
export function anyModelSupportsResolution(
  models: StoredModel[],
  selectedModelIds: string[]
): boolean {
  return selectedModelIds.some((modelId) => {
    const model = getModel(models, modelId);
    return model?.capabilities.supportsResolution;
  });
}

// Helper to check if any selected model supports reference images
export function anyModelSupportsReferenceImages(
  models: StoredModel[],
  selectedModelIds: string[]
): boolean {
  if (selectedModelIds.length === 0) return true; // If no models selected, allow reference images by default
  return selectedModelIds.some((modelId) => {
    const model = getModel(models, modelId);
    return model?.capabilities.supportsReferenceImages;
  });
}

export function getStrictReferenceImageLimit(
  models: StoredModel[],
  selectedModelIds: string[]
): number | null {
  if (selectedModelIds.length === 0) {
    return Infinity;
  }

  let limit = Infinity;

  for (const modelId of selectedModelIds) {
    const model = getModel(models, modelId);
    if (!model || !model.capabilities.supportsReferenceImages) {
      return null;
    }

    limit = Math.min(limit, model.capabilities.maxReferenceImages);
  }

  return Number.isFinite(limit) ? limit : Infinity;
}

// Helper to check if any selected model supports quality presets
export function anyModelSupportsQuality(
  models: StoredModel[],
  selectedModelIds: string[]
): boolean {
  return selectedModelIds.some((modelId) => {
    const model = getModel(models, modelId);
    return model?.capabilities.supportsQuality;
  });
}

// Intersection of quality enum values across selected quality-aware models.
export function getQualityIntersection(
  models: StoredModel[],
  selectedModelIds: string[]
): string[] {
  let intersection: Set<string> | null = null;

  for (const modelId of selectedModelIds) {
    const model = getModel(models, modelId);
    if (!model?.capabilities.supportsQuality) continue;

    const qualities = model.capabilities.supportedQualities ?? [...QUALITIES];
    const qualitySet = new Set(qualities);

    if (!intersection) {
      intersection = qualitySet;
      continue;
    }

    intersection = new Set([...intersection].filter((q) => qualitySet.has(q)));
  }

  return intersection ? [...intersection] : [];
}

// Helper to check if any selected model supports batch image generation.
export function anyModelSupportsNumberOfImages(
  models: StoredModel[],
  selectedModelIds: string[]
): boolean {
  return selectedModelIds.some((modelId) => {
    const model = getModel(models, modelId);
    return model?.capabilities.supportsNumberOfImages;
  });
}

// Strictest batch cap across selected batch-aware models. Falls back to 1
// when no selected model advertises the capability.
export function getMaxImagesPerRequest(
  models: StoredModel[],
  selectedModelIds: string[]
): number {
  let limit = Infinity;
  let sawBatchModel = false;

  for (const modelId of selectedModelIds) {
    const model = getModel(models, modelId);
    if (!model?.capabilities.supportsNumberOfImages) continue;
    sawBatchModel = true;
    limit = Math.min(limit, model.capabilities.maxImagesPerRequest ?? 1);
  }

  if (!sawBatchModel) return 1;
  return Number.isFinite(limit) ? limit : 1;
}

export function canAttachReferenceCount(
  models: StoredModel[],
  selectedModelIds: string[],
  totalReferenceCount: number
): { allowed: boolean; maxAllowed: number | null } {
  const maxAllowed = getStrictReferenceImageLimit(models, selectedModelIds);

  if (maxAllowed === null) {
    return { allowed: false, maxAllowed: null };
  }

  return {
    allowed: totalReferenceCount <= maxAllowed,
    maxAllowed,
  };
}
