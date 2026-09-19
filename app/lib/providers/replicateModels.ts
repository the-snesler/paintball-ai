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
  },
] satisfies ImageModelDefinition[];
