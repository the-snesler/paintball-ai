import type { StoredModel, StoredTextModel } from "~/types";

const BASE_BUILT_IN_MODELS: StoredModel[] = [
  {
    id: "gemini-2.5-flash-image",
    name: "Gemini 2.5 Flash",
    provider: "google",
    enabled: true,
    icon: "/icons/google.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: [
        "1:1",
        "2:3",
        "3:2",
        "3:4",
        "4:3",
        "4:5",
        "5:4",
        "9:16",
        "16:9",
        "21:9",
      ],
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: "gemini-3-pro-image-preview",
    name: "Gemini 3.0 Pro",
    provider: "google",
    enabled: true,
    icon: "/icons/google.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: [
        "1:1",
        "2:3",
        "3:2",
        "3:4",
        "4:3",
        "4:5",
        "5:4",
        "9:16",
        "16:9",
        "21:9",
      ],
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: "gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash",
    provider: "google",
    enabled: true,
    icon: "/icons/google.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: [
        "1:1",
        "1:4",
        "1:8",
        "2:3",
        "3:2",
        "3:4",
        "4:1",
        "4:3",
        "4:5",
        "5:4",
        "8:1",
        "9:16",
        "16:9",
        "21:9",
      ],
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: "replicate/google/nano-banana",
    name: "Nano Banana",
    provider: "replicate",
    enabled: true,
    icon: "/icons/google.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: [
        "1:1",
        "2:3",
        "3:2",
        "3:4",
        "4:3",
        "4:5",
        "5:4",
        "9:16",
        "16:9",
        "21:9",
      ],
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: "replicate/google/nano-banana-pro",
    name: "Nano Banana Pro",
    provider: "replicate",
    enabled: true,
    icon: "/icons/google.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: [
        "1:1",
        "2:3",
        "3:2",
        "3:4",
        "4:3",
        "4:5",
        "5:4",
        "9:16",
        "16:9",
        "21:9",
      ],
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 14,
    },
  },
  {
    id: "replicate/openai/gpt-image-1.5",
    name: "GPT Image 1.5",
    provider: "replicate",
    enabled: true,
    icon: "/icons/openai.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: ["1:1", "3:2", "2:3"],
      supportsResolution: false,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: "replicate/black-forest-labs/flux-2-flex",
    name: "Flux 2 Flex",
    provider: "replicate",
    enabled: true,
    icon: "/icons/bfl.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: ["1:1", "16:9", "3:2", "2:3", "4:5", "5:4", "9:16", "3:4", "4:3"],
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: "replicate/bytedance/seedream-4.5",
    name: "Seedream 4.5",
    provider: "replicate",
    enabled: true,
    icon: "/icons/bytedance.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 14,
    },
  },
];

const DEBUG_MODEL: StoredModel = {
  id: "debug/dev-placeholder",
  name: "Dev Placeholder",
  provider: "debug",
  enabled: true,
  capabilities: {
    supportsAspectRatios: true,
    supportedAspectRatios: [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
      "21:9",
    ],
    supportsResolution: true,
    supportsReferenceImages: true,
    maxReferenceImages: 10,
  },
};

export const BUILT_IN_MODELS: StoredModel[] = import.meta.env.DEV
  ? [...BASE_BUILT_IN_MODELS, DEBUG_MODEL]
  : BASE_BUILT_IN_MODELS;

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
      icon: existing.icon ?? builtInModel.icon,
      schemaFetched: existing.schemaFetched,
      ...builtInModel,
      enabled: existing.enabled,
    };
  });

  const customModels = models.filter((model) => !isBuiltInModel(model.id));

  return [...mergedBuiltIns, ...customModels];
}

export const BUILT_IN_TEXT_MODELS: StoredTextModel[] = [
  {
    id: "google:gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "google",
    modelId: "gemini-3-flash-preview",
    enabled: true,
    icon: "/icons/google.svg",
  },
  {
    id: "replicate:google/gemini-3-flash",
    name: "Gemini 3 Flash (Replicate)",
    provider: "replicate",
    modelId: "google/gemini-3-flash",
    enabled: false,
    icon: "/icons/google.svg",
  },
];

const BUILT_IN_TEXT_MODEL_IDS = new Set(BUILT_IN_TEXT_MODELS.map((m) => m.id));

export function isBuiltInTextModel(id: string): boolean {
  return BUILT_IN_TEXT_MODEL_IDS.has(id);
}

export function mergeWithBuiltInTextModels(models?: StoredTextModel[]): StoredTextModel[] {
  if (!models || models.length === 0) {
    return BUILT_IN_TEXT_MODELS.map((m) => ({ ...m }));
  }

  const existingById = new Map(models.map((m) => [m.id, m]));

  const mergedBuiltIns = BUILT_IN_TEXT_MODELS.map((builtIn) => {
    const existing = existingById.get(builtIn.id);
    if (!existing) return { ...builtIn };
    return {
      ...builtIn,
      enabled: existing.enabled,
    };
  });

  const customModels = models.filter((m) => !isBuiltInTextModel(m.id) && m.isCustom);

  const merged = [...mergedBuiltIns, ...customModels];

  // Ensure exactly one enabled: if zero, enable the first built-in; if multiple, keep first.
  const enabledCount = merged.filter((m) => m.enabled).length;
  if (enabledCount === 0 && merged.length > 0) {
    merged[0] = { ...merged[0], enabled: true };
  } else if (enabledCount > 1) {
    let seenEnabled = false;
    for (let i = 0; i < merged.length; i++) {
      if (merged[i].enabled) {
        if (seenEnabled) merged[i] = { ...merged[i], enabled: false };
        else seenEnabled = true;
      }
    }
  }

  return merged;
}
