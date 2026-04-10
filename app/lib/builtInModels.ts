import type { StoredModel } from "~/types";

export const BUILT_IN_MODELS: StoredModel[] = [
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
    name: "SeeDream 4.5",
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
