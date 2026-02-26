import type { StoredModel } from '~/types';

export const BUILT_IN_MODELS: StoredModel[] = [
  {
    id: 'gemini-2.5-flash-image',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    enabled: true,
    icon: '/icons/google.svg',
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Gemini 3.0 Pro',
    provider: 'google',
    enabled: true,
    icon: '/icons/google.svg',
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Gemini 3.1 Flash',
    provider: 'google',
    enabled: true,
    icon: '/icons/google.svg',
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: 'replicate/google/nano-banana',
    name: 'Nano Banana',
    provider: 'replicate',
    enabled: true,
    icon: '/icons/google.svg',
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: 'replicate/google/nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'replicate',
    enabled: true,
    icon: '/icons/google.svg',
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 14,
    },
  },
  {
    id: 'replicate/openai/gpt-image-1.5',
    name: 'GPT Image 1.5',
    provider: 'replicate',
    enabled: true,
    icon: '/icons/openai.svg',
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 1,
    },
  },
  {
    id: 'replicate/black-forest-labs/flux-2-flex',
    name: 'Flux 2 Flex',
    provider: 'replicate',
    enabled: true,
    icon: '/icons/bfl.svg',
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 1,
    },
  },
  {
    id: 'replicate/bytedance/seedream-4.5',
    name: 'SeeDream 4.5',
    provider: 'replicate',
    enabled: true,
    icon: '/icons/bytedance.svg',
    capabilities: {
      supportsAspectRatios: true,
      supportsResolution: false,
      supportsReferenceImages: false,
      maxReferenceImages: 0,
    },
  },
];

const BUILT_IN_MODEL_IDS = new Set(BUILT_IN_MODELS.map((model) => model.id));

export function isBuiltInModel(id: string): boolean {
  return BUILT_IN_MODEL_IDS.has(id);
}

export function mergeWithBuiltInModels(models?: StoredModel[]): StoredModel[] {
  if (!models || models.length === 0) {
    return BUILT_IN_MODELS.map((model) => ({ ...model }));
  }

  const existingById = new Map(models.map((model) => [model.id, model]));

  const mergedBuiltIns = BUILT_IN_MODELS.map((builtInModel) => {
    const existing = existingById.get(builtInModel.id);

    if (!existing) {
      return { ...builtInModel };
    }

    return {
      ...builtInModel,
      enabled: existing.enabled,
      capabilities: existing.capabilities,
      icon: existing.icon ?? builtInModel.icon,
      schemaFetched: existing.schemaFetched,
    };
  });

  const customModels = models.filter((model) => !isBuiltInModel(model.id));

  return [...mergedBuiltIns, ...customModels];
}
