import { parseAspectRatio } from "~/lib/models";
import type { GenerationParams, GenerationResult } from "~/lib/generation";
import { getImageDimensions } from "~/lib/imageProcessing";
import type { AspectRatio, Resolution } from "~/types";
import type { Provider } from "./types";

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

async function generateImage(params: GenerationParams): Promise<GenerationResult> {
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

  ctx.font = `600 ${headlineSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText("DEBUG", width / 2, height / 2 - headlineSize * 0.7);

  ctx.font = `${detailSize}px ui-monospace, monospace`;
  ctx.fillText(params.modelId, width / 2, height / 2 + detailSize * 0.25);

  const promptPreview = params.prompt.trim().slice(0, 80) || "No prompt";
  ctx.fillStyle = "#52525b";
  ctx.fillText(promptPreview, width / 2, height / 2 + detailSize * 1.8);

  await new Promise((resolve) => window.setTimeout(resolve, 350));

  const blob = await canvasToBlob(canvas);
  const dimensions = await getImageDimensions(blob);

  return {
    blob,
    width: dimensions.width,
    height: dimensions.height,
    metadata: {
      debug: true,
      generatedAt: new Date().toISOString(),
      referenceImageCount: params.referenceImages.length,
    },
  };
}

export const debugProvider: Provider = {
  id: "debug",
  label: "Debug",
  requiresApiKey: false,
  capabilities: {
    image: true,
    text: false,
    upscale: false,
    searchImage: false,
    searchText: false,
    searchUpscale: false,
    resolveImageModel: false,
  },
  generateImage,
};
