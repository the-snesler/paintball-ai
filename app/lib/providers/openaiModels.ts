import type { ImageModelDefinition } from "./modelLibrary";

export interface OpenAIImageModelConfig {
  sizeMode: "fixed" | "arbitrary";
}

export const OPENAI_IMAGE_MODELS = [
  {
    id: "gpt-image-2.5-flare",
    provider: "openai",
    name: "GPT Image 2.5 Flare",
    icon: "/icons/openai.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: [],
      allowsArbitraryAspectRatio: true,
      maxLongShortRatio: 3,
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 16,
      supportsQuality: true,
      supportedQualities: ["low", "medium", "high", "xhigh", "max"],
      supportsNumberOfImages: true,
      maxImagesPerRequest: 10,
    },
    config: { sizeMode: "arbitrary" },
  },
  {
    id: "gpt-image-2.5-sunburst",
    provider: "openai",
    name: "GPT Image 2.5 Sunburst",
    icon: "/icons/openai.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: [],
      allowsArbitraryAspectRatio: true,
      maxLongShortRatio: 3,
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 16,
      supportsQuality: true,
      supportedQualities: ["low", "medium", "high", "xhigh", "max"],
      supportsNumberOfImages: true,
      maxImagesPerRequest: 10,
    },
    config: { sizeMode: "arbitrary" },
  },
] satisfies ImageModelDefinition<OpenAIImageModelConfig>[];
