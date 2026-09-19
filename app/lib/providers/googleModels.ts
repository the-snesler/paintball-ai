import type { ImageModelDefinition } from "./modelLibrary";

const STANDARD_ASPECT_RATIOS = [
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
];

export const GOOGLE_IMAGE_MODELS = [
  {
    id: "gemini-3-pro-image-preview",
    provider: "google",
    name: "Gemini 3.0 Pro",
    icon: "/icons/google.svg",
    capabilities: {
      supportsAspectRatios: true,
      supportedAspectRatios: STANDARD_ASPECT_RATIOS,
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 10,
    },
  },
  {
    id: "gemini-3.1-flash-image-preview",
    provider: "google",
    name: "Gemini 3.1 Flash",
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
] satisfies ImageModelDefinition[];
