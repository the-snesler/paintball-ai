import type { AspectRatio, StoredModel } from '~/types';

export const ASPECT_RATIOS: { value: AspectRatio; label: string; width: number; height: number }[] = [
  { value: '1:1', label: '1:1', width: 1, height: 1 },
  { value: '16:9', label: '16:9', width: 16, height: 9 },
  { value: '9:16', label: '9:16', width: 9, height: 16 },
  { value: '4:3', label: '4:3', width: 4, height: 3 },
  { value: '3:4', label: '3:4', width: 3, height: 4 },
  { value: '21:9', label: '21:9', width: 21, height: 9 },
];

export const RESOLUTIONS = ['1K', '2K', '4K'] as const;

// Helper to get a model by ID from a models array
export function getModel(models: StoredModel[], modelId: string): StoredModel | undefined {
  return models.find(m => m.id === modelId);
}

// Helper to check if any selected model supports aspect ratios
export function anyModelSupportsAspectRatio(models: StoredModel[], selectedModelIds: string[]): boolean {
  return selectedModelIds.some(modelId => {
    const model = getModel(models, modelId);
    return model?.capabilities.supportsAspectRatios;
  });
}

// Helper to check if any selected model supports resolution
export function anyModelSupportsResolution(models: StoredModel[], selectedModelIds: string[]): boolean {
  return selectedModelIds.some(modelId => {
    const model = getModel(models, modelId);
    return model?.capabilities.supportsResolution;
  });
}

// Helper to check if any selected model supports reference images
export function anyModelSupportsReferenceImages(models: StoredModel[], selectedModelIds: string[]): boolean {
  return selectedModelIds.some(modelId => {
    const model = getModel(models, modelId);
    return model?.capabilities.supportsReferenceImages;
  });
}
