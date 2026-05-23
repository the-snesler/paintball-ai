import { parseAspectRatio } from "~/lib/models";
import type { GenerationParams, GenerationResult } from "~/lib/generation";
import { getImageDimensions } from "~/lib/imageProcessing";
import type { AspectRatio, Resolution } from "~/types";
import type { Provider, ResolvedImageModel, SearchResult } from "./types";
import { DEFAULT_IMAGE_CAPABILITIES } from "../builtInModels";
import { inferName } from "../modelNames";
import { normalizeModelId } from ".";

type Deferred = {
  resolve: (r: GenerationResult) => void;
  reject: (e: Error) => void;
  promise: Promise<GenerationResult>;
};
const manualDeferred = new Map<string, Deferred>();

function getOrCreateDeferred(itemId: string): Deferred {
  if (!manualDeferred.has(itemId)) {
    let resolve!: (r: GenerationResult) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<GenerationResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    manualDeferred.set(itemId, { resolve, reject, promise });
  }
  return manualDeferred.get(itemId)!;
}

export function resolveManualItem(itemId: string, result: GenerationResult): void {
  manualDeferred.get(itemId)?.resolve(result);
  manualDeferred.delete(itemId);
}

export function rejectManualItem(itemId: string): void {
  manualDeferred.get(itemId)?.reject(new Error("Dismissed"));
  manualDeferred.delete(itemId);
}

const DEBUG_RESOLUTION_WIDTH: Record<Resolution, number> = {
  "1K": 1024,
  "2K": 2048,
  "4K": 4096,
};

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to create debug image"));
      }
    }, "image/png");
  });
}

function getDebugDimensions(
  aspectRatio: AspectRatio | null,
  resolution: Resolution | null
): { width: number; height: number } {
  const { width: ratioWidth, height: ratioHeight } = parseAspectRatio(aspectRatio ?? "1:1");
  const baseWidth = resolution ? DEBUG_RESOLUTION_WIDTH[resolution] : 1024;
  const computedHeight = Math.round((baseWidth * ratioHeight) / ratioWidth);

  return {
    width: Math.max(1, baseWidth),
    height: Math.max(1, computedHeight),
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generatePicsumImage(
  params: GenerationParams,
  sleepBase: number = 7000
): Promise<GenerationResult[]> {
  const { width, height } = getDebugDimensions(params.aspectRatio, params.resolution);
  const n = Math.max(1, params.numberOfImages);
  const results: GenerationResult[] = [];

  for (let i = 0; i < n; i++) {
    // "finish generating" at a random time between sleepBase and sleepBase * 1.3
    await sleep(Math.floor(Math.random() * 0.3 + 1) * sleepBase);
    // Append a cache-busting seed so each request in the batch yields a different photo.
    const seed = Math.floor(Math.random() * 1_000_000);
    const url = `https://picsum.photos/seed/${seed}/${width}/${height}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`picsum fetch failed: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    const dimensions = await getImageDimensions(blob);

    results.push({
      blob,
      width: dimensions.width,
      height: dimensions.height,
      metadata: {
        debug: true,
        picsum: true,
        picsumSeed: seed,
        generatedAt: new Date().toISOString(),
        batchIndex: i,
      },
    });
  }

  return results;
}

async function generateCanvasImage(params: GenerationParams): Promise<GenerationResult[]> {
  const { width, height } = getDebugDimensions(params.aspectRatio, params.resolution);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create debug canvas");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d4d4d8";
  ctx.lineWidth = Math.max(4, Math.round(Math.min(width, height) * 0.01));
  ctx.strokeRect(0, 0, width, height);

  const headlineSize = Math.max(24, Math.round(Math.min(width, height) * 0.06));
  const detailSize = Math.max(16, Math.round(headlineSize * 0.45));
  ctx.fillStyle = "#18181b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const results: GenerationResult[] = [];
  const n = Math.max(1, params.numberOfImages);

  for (let i = 0; i < n; i++) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#d4d4d8";
    ctx.strokeRect(0, 0, width, height);

    ctx.fillStyle = "#18181b";
    ctx.font = `600 ${headlineSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(
      n > 1 ? `DEBUG ${i + 1}/${n}` : "DEBUG",
      width / 2,
      height / 2 - headlineSize * 0.7
    );

    ctx.font = `${detailSize}px ui-monospace, monospace`;
    ctx.fillText(params.modelId, width / 2, height / 2 + detailSize * 0.25);

    const promptPreview = params.prompt.trim().slice(0, 80) || "No prompt";
    ctx.fillStyle = "#52525b";
    ctx.fillText(promptPreview, width / 2, height / 2 + detailSize * 1.8);

    await new Promise((resolve) => window.setTimeout(resolve, 350));

    const blob = await canvasToBlob(canvas);
    const dimensions = await getImageDimensions(blob);

    results.push({
      blob,
      width: dimensions.width,
      height: dimensions.height,
      metadata: {
        debug: true,
        generatedAt: new Date().toISOString(),
        referenceImageCount: params.referenceImages.length,
        batchIndex: i,
      },
    });
  }

  return results;
}

async function generateImage(params: GenerationParams): Promise<GenerationResult[]> {
  const modelId = normalizeModelId(params.modelId, "debug");

  switch (modelId) {
    case "picsum":
      return generatePicsumImage(params, 7000);
    case "slow":
      return generatePicsumImage(params, 10 * 1000 * 60);
    case "manual":
      const ids = params.itemIds ?? [];
      return Promise.all(ids.map((id) => getOrCreateDeferred(id).promise));
    case "debug-model":
      return generateCanvasImage(params);
    default:
      throw new Error(`Unknown model: ${modelId}`);
  }
}

async function searchModels(query: string, apiKey: string): Promise<SearchResult[]> {
  return [
    {
      id: "debug-model",
      name: "Debug Model",
      description: "Generates basic placeholder images in the browser.",
      icon: "/icons/box.svg",
    },
    {
      id: "picsum",
      name: "Picsum Photos",
      description: "Fetches random placeholder photos from picsum.photos.",
      icon: "/icons/box.svg",
    },
    {
      id: "slow",
      name: "Slow",
      description: "Waits 10 minutes to fetch an image from picsum.photos.",
      icon: "/icons/box.svg",
    },
    {
      id: "manual",
      name: "Manual Upload",
      description: "Prompts you to upload an image instead of generating one.",
      icon: "/icons/box.svg",
    },
  ];
}

async function resolveImageModel(
  modelId: string,
  apiKey: string,
  onProgress?: (status: string) => void
): Promise<ResolvedImageModel> {
  if (modelId === "manual") {
    return {
      name: "Manual Upload",
      capabilities: {
        supportsAspectRatios: false,
        supportsResolution: false,
        supportsReferenceImages: true,
        maxReferenceImages: 10,
      },
      icon: "/icons/box.svg",
    };
  }
  return {
    name: inferName(modelId),
    capabilities: DEFAULT_IMAGE_CAPABILITIES,
    icon: "/icons/box.svg",
  };
}

export const debugProvider: Provider = {
  id: "debug",
  label: "Debug",
  iconPath: "/icons/box.svg",
  requiresApiKey: false,
  capabilities: {
    image: true,
    text: false,
    upscale: false,
    searchImage: true,
    searchText: false,
    searchUpscale: false,
  },
  generateImage,
  searchImageModels: searchModels,
  resolveImageModel,
};
