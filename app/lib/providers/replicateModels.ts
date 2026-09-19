import type { ImageModelDefinition } from "./modelLibrary";

export const REPLICATE_IMAGE_MODELS = [
  {
    id: "google/nano-banana-pro",
    provider: "replicate",
    name: "Nano Banana Pro",
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
    pricing: {
      currency: "USD",
      source: {
        kind: "model-library",
        url: "https://replicate.com/google/nano-banana-pro",
        fetchedAt: Date.UTC(2026, 8, 19),
      },
      rules: [
        { metric: "outputImages", units: 1, usd: 0.15, when: { resolutions: ["1K", "2K"] } },
        { metric: "outputImages", units: 1, usd: 0.3, when: { resolutions: ["4K"] } },
      ],
    },
  },
  {
    id: "black-forest-labs/flux-2-flex",
    provider: "replicate",
    name: "Flux 2 Flex",
    icon: "/icons/bfl.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: ["1:1", "16:9", "3:2", "2:3", "4:5", "5:4", "9:16", "3:4", "4:3"],
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
    pricing: {
      currency: "USD",
      source: {
        kind: "model-library",
        url: "https://replicate.com/black-forest-labs/flux-2-flex",
        fetchedAt: Date.UTC(2026, 8, 19),
      },
      rules: [
        { metric: "inputMegapixels", units: 1, usd: 0.06 },
        { metric: "outputMegapixels", units: 1, usd: 0.06 },
      ],
    },
  },
  {
    id: "bytedance/seedream-4.5",
    provider: "replicate",
    name: "Seedream 4.5",
    icon: "/icons/bytedance.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 14,
    },
    schemaMapping: {
      resolutionKey: "size",
    },
    pricing: {
      currency: "USD",
      source: {
        kind: "model-library",
        url: "https://replicate.com/bytedance/seedream-4.5",
        fetchedAt: Date.UTC(2026, 8, 19),
      },
      rules: [{ metric: "outputImages", units: 1, usd: 0.04 }],
    },
  },
] satisfies ImageModelDefinition[];
