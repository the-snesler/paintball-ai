import type { AspectRatio, ModelDefinition } from '~/types';

export const ASPECT_RATIOS: { value: AspectRatio; label: string; width: number; height: number }[] = [
  { value: '1:1', label: '1:1', width: 1, height: 1 },
  { value: '16:9', label: '16:9', width: 16, height: 9 },
  { value: '9:16', label: '9:16', width: 9, height: 16 },
  { value: '4:3', label: '4:3', width: 4, height: 3 },
  { value: '3:4', label: '3:4', width: 3, height: 4 },
  { value: '21:9', label: '21:9', width: 21, height: 9 },
];

export const RESOLUTIONS = ['1K', '2K', '4K'] as const;

export const MODELS: ModelDefinition[] = [
  {
    id: 'gemini-2.5-flash-image',
    name: 'Gemini 2.5 Flash Image',
    provider: 'google',
    apiKeyRequired: 'google',
    capabilities: {
      aspectRatios: [],
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
    defaultAspectRatio: '1:1',
    maxImagesPerRequest: 1,
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Gemini 3.0 Pro Image',
    provider: 'google',
    apiKeyRequired: 'google',
    capabilities: {
      aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
    defaultAspectRatio: '1:1',
    maxImagesPerRequest: 1,
  },
  // Placeholder for future models - user mentioned gemini-3-pro-image-preview
  // which supports resolution (1K, 2K, 4K)
];

// Helper to get a model by ID
export function getModel(modelId: string): ModelDefinition | undefined {
  return MODELS.find(m => m.id === modelId);
}

// Helper to get models that are enabled (have API key)
export function getEnabledModels(apiKeys: Record<string, string | null>): ModelDefinition[] {
  return MODELS.filter(m => apiKeys[m.apiKeyRequired]);
}

// Helper to check if aspect ratio is supported by selected models
export function isAspectRatioSupported(
  aspectRatio: AspectRatio,
  selectedModelIds: string[]
): boolean {
  if (selectedModelIds.length === 0) return true;

  return selectedModelIds.every(modelId => {
    const model = getModel(modelId);
    return model?.capabilities.aspectRatios.includes(aspectRatio);
  });
}

// Helper to check if any selected model supports aspect ratios
export function anyModelSupportsAspectRatio(selectedModelIds: string[]): boolean {
  return selectedModelIds.some(modelId => {
    const model = getModel(modelId);
    return model && model.capabilities.aspectRatios.length > 0;
  });
}

// Helper to get common aspect ratios across selected models (only considers aspect-capable models)
export function getCommonAspectRatios(selectedModelIds: string[]): AspectRatio[] {
  if (selectedModelIds.length === 0) return ASPECT_RATIOS.map(ar => ar.value);

  // Only consider models that support aspect ratios
  const aspectCapableModels = selectedModelIds
    .map(id => getModel(id))
    .filter((m): m is ModelDefinition => !!m && m.capabilities.aspectRatios.length > 0);

  if (aspectCapableModels.length === 0) return [];

  // Return intersection of aspect-capable models only
  return aspectCapableModels[0].capabilities.aspectRatios.filter(ratio =>
    aspectCapableModels.every(m => m.capabilities.aspectRatios.includes(ratio))
  );
}

// Helper to check if any selected model supports resolution
export function anyModelSupportsResolution(selectedModelIds: string[]): boolean {
  return selectedModelIds.some(modelId => {
    const model = getModel(modelId);
    return model?.capabilities.supportsResolution;
  });
}
