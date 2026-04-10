import { GoogleGenAI } from "@google/genai";
import Replicate from "replicate";
import { parseAspectRatio } from "~/lib/models";
import { useSettingsStore } from "~/stores/settingsStore";
import type { AspectRatio, Provider, Resolution } from "~/types";
import { blobToBase64 } from "./util";
import { getImageDimensions } from "./imageProcessing";
import { toRateLimitError } from "./retry";

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export interface GenerationParams {
  modelId: string;
  provider: Provider;
  prompt: string;
  aspectRatio: AspectRatio | null;
  resolution: Resolution | null;
  referenceImages: Array<{ id: string; blob: Blob }>;
}

export interface GenerationResult {
  blob: Blob;
  width: number;
  height: number;
  metadata: Record<string, unknown>;
}

export async function executeGeneration(
  params: GenerationParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (params.provider === "google") return generateWithGoogle(params, apiKey);
  if (params.provider === "replicate") return generateWithReplicate(params, apiKey);
  if (params.provider === "debug") return generateWithDebug(params);
  throw new Error(`Provider ${params.provider} not implemented`);
}

export async function generateWithGoogle(
  params: GenerationParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) throw new Error("No API key for google");
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  for (const ref of params.referenceImages) {
    const base64 = await blobToBase64(ref.blob);
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: base64.split(",")[1],
      },
    });
  }
  parts.push({ text: params.prompt });

  const config = {
    responseModalities: ["IMAGE"],
    ...(params.aspectRatio || params.resolution
      ? {
          imageConfig: {
            ...(params.aspectRatio && { aspectRatio: params.aspectRatio }),
            ...(params.resolution && { imageSize: params.resolution }),
          },
        }
      : {}),
  };

  let response;
  try {
    response = await ai.models.generateContentStream({
      model: params.modelId,
      config,
      contents: [{ role: "user", parts }],
    });
  } catch (error) {
    throw toRateLimitError(error, "google");
  }

  let imageBlob: Blob | null = null;
  let modelVersion: string | undefined;

  for await (const chunk of response) {
    if (!chunk.candidates?.[0]?.content?.parts) continue;
    const inlineData = chunk.candidates[0].content.parts[0]?.inlineData;
    if (inlineData?.data && inlineData?.mimeType) {
      const binaryString = atob(inlineData.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      imageBlob = new Blob([bytes], { type: inlineData.mimeType });
    }
    if (chunk.modelVersion) modelVersion = chunk.modelVersion;
  }

  if (!imageBlob) throw new Error("No image in response");
  const dimensions = await getImageDimensions(imageBlob);

  return {
    blob: imageBlob,
    width: dimensions.width,
    height: dimensions.height,
    metadata: { modelVersion },
  };
}

export async function generateWithReplicate(
  params: GenerationParams,
  apiKey?: string
): Promise<GenerationResult> {
  if (!apiKey) throw new Error("No API key for replicate");
  const baseUrl = new URL("/proxy/replicate/v1", window.location.origin).toString();
  const replicate = new Replicate({ auth: apiKey, baseUrl });

  const imageInputs = await Promise.all(
    params.referenceImages.map(async (ref) => blobToBase64(ref.blob))
  );

  const model = useSettingsStore.getState().models.find((m) => m.id === params.modelId);
  const mapping = model?.schemaMapping;

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    output_format: "png",
  };
  if (params.aspectRatio) {
    const aspectRatioKey = mapping?.aspectRatioKey ?? "aspect_ratio";
    input[aspectRatioKey] = params.aspectRatio;
  }
  if (imageInputs.length > 0) {
    const imageKey = mapping?.imageInputKey ?? "image_input";
    input[imageKey] = imageInputs;
  }
  if (params.resolution) {
    input.resolution = mapping?.resolution?.[params.resolution] ?? params.resolution;
  }
  if (mapping?.extraDefaults) {
    for (const [key, value] of Object.entries(mapping.extraDefaults)) {
      if (!(key in input)) input[key] = value;
    }
  }

  const replicateModel = params.modelId.replace("replicate/", "") as `${string}/${string}`;

  let output;
  try {
    output = await replicate.run(replicateModel, { input });
  } catch (error) {
    throw toRateLimitError(error, "replicate");
  }

  const imageUrl =
    typeof output === "object" && output !== null && "url" in output
      ? (output as { url: () => string }).url()
      : Array.isArray(output)
        ? output[0]
        : String(output);

  if (!imageUrl) throw new Error("No image in Replicate response");

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok)
    throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);

  const blob = await imageResponse.blob();
  const dimensions = await getImageDimensions(blob);

  return { blob, width: dimensions.width, height: dimensions.height, metadata: {} };
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

export async function generateWithDebug(params: GenerationParams): Promise<GenerationResult> {
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
