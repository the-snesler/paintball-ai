import OpenAI, { toFile } from "openai";
import { distance } from "fastest-levenshtein";
import type { GenerationParams, GenerationResult } from "~/lib/generation";
import { getImageDimensions } from "~/lib/imageProcessing";
import { toRateLimitError } from "~/lib/retry";
import type { AspectRatio, Resolution } from "~/types";
import type { Provider, ResolvedImageModel, SearchResult } from "./types";
import { inferName } from "../modelNames";
import { normalizeModelId } from ".";

function openaiBaseUrl(): string {
  return new URL("/proxy/openai/v1", window.location.origin).toString();
}

function createClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: openaiBaseUrl(),
    dangerouslyAllowBrowser: true,
  });
}

// gpt-image-1 (and unknown OpenAI image models) accept only a fixed set of size strings.
const ASPECT_RATIO_TO_SIZE: Record<string, "1024x1024" | "1536x1024" | "1024x1536"> = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

// gpt-image-2 accepts arbitrary WxH within these constraints.
const GPT_IMAGE_2_MAX_EDGE = 3840;
const GPT_IMAGE_2_MIN_PIXELS = 655_360;
const GPT_IMAGE_2_MAX_PIXELS = 8_294_400;
const GPT_IMAGE_2_MAX_LONG_SHORT_RATIO = 3;

// Per-resolution target pixel counts, chosen to match the docs' popular sizes
// (1024x1024 for 1K, 2048x2048 for 2K, 3840x2160 for 4K).
const GPT_IMAGE_2_RESOLUTION_PIXELS: Record<Resolution, number> = {
  "1K": 1024 * 1024,
  "2K": 2048 * 2048,
  "4K": 3840 * 2160,
};

function isGptImage2(modelId: string): boolean {
  return /(^|[-_/])gpt-image-2/.test(modelId.toLowerCase());
}

// Snap downward to a multiple of 16 to stay within the model's pixel cap.
function snap16(value: number): number {
  return Math.max(16, Math.floor(value / 16) * 16);
}

function resolveGptImage2Size(
  aspectRatio: AspectRatio,
  resolution: Resolution | null
): string | null {
  const [wStr, hStr] = aspectRatio.split(":");
  const wRatio = Number(wStr);
  const hRatio = Number(hStr);
  if (!Number.isFinite(wRatio) || !Number.isFinite(hRatio) || wRatio <= 0 || hRatio <= 0) {
    return null;
  }

  const longShort = Math.max(wRatio, hRatio) / Math.min(wRatio, hRatio);
  if (longShort > GPT_IMAGE_2_MAX_LONG_SHORT_RATIO) return null;

  const target = GPT_IMAGE_2_RESOLUTION_PIXELS[resolution ?? "1K"];

  let w = Math.sqrt((target * wRatio) / hRatio);
  let h = (w * hRatio) / wRatio;

  // Cap the long edge first, then recompute the other side.
  if (w > GPT_IMAGE_2_MAX_EDGE) {
    w = GPT_IMAGE_2_MAX_EDGE;
    h = (w * hRatio) / wRatio;
  }
  if (h > GPT_IMAGE_2_MAX_EDGE) {
    h = GPT_IMAGE_2_MAX_EDGE;
    w = (h * wRatio) / hRatio;
  }

  const width = snap16(w);
  const height = snap16(h);
  const pixels = width * height;

  if (
    width > GPT_IMAGE_2_MAX_EDGE ||
    height > GPT_IMAGE_2_MAX_EDGE ||
    pixels < GPT_IMAGE_2_MIN_PIXELS ||
    pixels > GPT_IMAGE_2_MAX_PIXELS
  ) {
    return null;
  }

  return `${width}x${height}`;
}

function resolveSize(
  modelId: string,
  aspectRatio: AspectRatio | null,
  resolution: Resolution | null
): string {
  if (!aspectRatio) return "auto";
  if (isGptImage2(modelId)) {
    return resolveGptImage2Size(aspectRatio, resolution) ?? "auto";
  }
  return ASPECT_RATIO_TO_SIZE[aspectRatio] ?? "auto";
}

function decodeBase64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function mimeTypeForFormat(format: "png" | "jpeg" | "webp"): string {
  return format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
}

async function generateImage(
  params: GenerationParams,
  apiKey?: string
): Promise<GenerationResult[]> {
  if (!apiKey) throw new Error("No API key for openai");
  const client = createClient(apiKey);
  const modelId = normalizeModelId(params.modelId, "openai");

  const size = resolveSize(modelId, params.aspectRatio, params.resolution);
  const n = Math.max(1, params.numberOfImages);
  const outputFormat: "png" | "jpeg" | "webp" = "png";
  const quality = (params.quality ?? undefined) as "low" | "medium" | "high" | "auto" | undefined;

  // The SDK's `size` is typed as a closed union of the docs' popular strings, but
  // gpt-image-2 accepts any WxH within its constraints. Cast through `as never` so
  // the runtime forwards arbitrary computed sizes (e.g. "3840x2160", "2480x3312").
  const sizeParam = size as never;

  try {
    if (params.referenceImages.length > 0) {
      const files = await Promise.all(
        params.referenceImages.map((ref, index) =>
          toFile(ref.blob, `reference-${index}.${ref.blob.type.split("/")[1] || "png"}`, {
            type: ref.blob.type || "image/png",
          })
        )
      );

      const response = await client.images.edit({
        model: modelId,
        image: files,
        prompt: params.prompt,
        n,
        size: sizeParam,
        ...(quality ? { quality } : {}),
        output_format: outputFormat,
      });

      return parseResponse(response, outputFormat, modelId);
    }

    const response = await client.images.generate({
      model: modelId,
      prompt: params.prompt,
      n,
      size: sizeParam,
      ...(quality ? { quality } : {}),
      output_format: outputFormat,
    });

    return parseResponse(response, outputFormat, modelId);
  } catch (error) {
    throw toRateLimitError(error, "openai");
  }
}

async function parseResponse(
  response: { data?: Array<{ b64_json?: string | null; url?: string | null }> | null },
  outputFormat: "png" | "jpeg" | "webp",
  modelId: string
): Promise<GenerationResult[]> {
  const entries = response.data ?? [];
  if (entries.length === 0) throw new Error("No image in OpenAI response");

  const mimeType = mimeTypeForFormat(outputFormat);

  return Promise.all(
    entries.map(async (entry) => {
      let blob: Blob;
      if (entry.b64_json) {
        blob = decodeBase64ToBlob(entry.b64_json, mimeType);
      } else if (entry.url) {
        const res = await fetch(entry.url);
        if (!res.ok) throw new Error(`Failed to fetch generated image: ${res.status}`);
        blob = await res.blob();
      } else {
        throw new Error("Empty image entry in OpenAI response");
      }

      const dimensions = await getImageDimensions(blob);
      return {
        blob,
        width: dimensions.width,
        height: dimensions.height,
        metadata: { modelId },
      };
    })
  );
}

interface OpenAIModel {
  id: string;
  owned_by?: string;
}

function inferOpenAiImageCapabilities(modelId: string): ResolvedImageModel["capabilities"] {
  const lower = normalizeModelId(modelId, "openai").toLowerCase();
  const isGptImage = /(^|[-_])gpt-image/.test(lower);

  if (!isGptImage) {
    return {
      supportsAspectRatios: true,
      supportedAspectRatios: ["1:1"],
      supportsResolution: false,
      supportsReferenceImages: false,
      maxReferenceImages: 1,
      supportsQuality: false,
      supportsNumberOfImages: false,
      maxImagesPerRequest: 1,
    };
  }

  // gpt-image-2 accepts any AR within constraints (resolved at call time);
  // older gpt-image models accept the fixed 3-size enum.
  if (isGptImage2(lower)) {
    return {
      supportsAspectRatios: true,
      supportedAspectRatios: [],
      supportsResolution: true,
      supportsReferenceImages: true,
      maxReferenceImages: 16,
      supportsQuality: true,
      supportedQualities: ["low", "medium", "high", "auto"],
      supportsNumberOfImages: true,
      maxImagesPerRequest: 10,
    };
  }

  return {
    supportsAspectRatios: true,
    supportedAspectRatios: ["1:1", "3:2", "2:3"],
    supportsResolution: false,
    supportsReferenceImages: true,
    maxReferenceImages: 16,
    supportsQuality: true,
    supportedQualities: ["low", "medium", "high", "auto"],
    supportsNumberOfImages: true,
    maxImagesPerRequest: 10,
  };
}

async function resolveImageModel(
  modelId: string,
  apiKey: string,
  onProgress?: (status: string) => void
): Promise<ResolvedImageModel> {
  const client = createClient(apiKey);
  const normalizedId = normalizeModelId(modelId, "openai");

  onProgress?.("Looking up model...");

  let found: OpenAIModel | null = null;
  try {
    const retrieved = await client.models.retrieve(normalizedId);
    found = { id: retrieved.id, owned_by: (retrieved as { owned_by?: string }).owned_by };
  } catch {
    try {
      const listed = await client.models.list();
      found =
        (listed.data as OpenAIModel[]).find(
          (m) => m.id.toLowerCase() === normalizedId.toLowerCase()
        ) ?? null;
    } catch {
      found = null;
    }
  }

  if (!found) {
    throw new Error(`Model not found: ${normalizedId}`);
  }
  if (!isImageModel(found)) {
    throw new Error(`Model is not an image generation model: ${normalizedId}`);
  }

  onProgress?.("Analyzing capabilities...");
  return {
    name: inferName(found.id),
    capabilities: inferOpenAiImageCapabilities(found.id),
    icon: "/icons/openai.svg",
  };
}

function isImageModel(model: OpenAIModel): boolean {
  const id = model.id.toLowerCase();
  // Keep image search focused on generation/edit models users can add.
  return /(^|[-_])(gpt-image|image|dall-e)/.test(id);
}

function toSearchResult(model: OpenAIModel): SearchResult {
  return {
    id: model.id,
    name: inferName(model.id),
    description: model.owned_by ? `Owner: ${model.owned_by}` : "OpenAI image model",
    icon: "/icons/openai.svg",
  };
}

async function searchImageModels(query: string, apiKey: string): Promise<SearchResult[]> {
  const client = createClient(apiKey);

  let models: OpenAIModel[] = [];
  try {
    const response = await client.models.list();
    models = response.data as OpenAIModel[];
  } catch {
    return [];
  }

  const q = query.trim().toLowerCase();
  const imageModels = models.filter(isImageModel);

  if (!q) {
    return imageModels.slice(0, 6).map(toSearchResult);
  }

  const ranked = imageModels
    .map((model) => {
      const id = model.id.toLowerCase();
      const containsBoost = id.includes(q) ? -1000 : 0;
      const score = distance(q, id) + containsBoost;
      return { model, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map(({ model }) => toSearchResult(model));

  return ranked;
}

export const openaiProvider: Provider = {
  id: "openai",
  label: "OpenAI",
  iconPath: "/icons/openai.svg",
  requiresApiKey: true,
  capabilities: {
    image: true,
    text: false,
    upscale: false,
    searchImage: true,
    searchText: false,
    searchUpscale: false,
  },
  generateImage,
  searchImageModels,
  resolveImageModel,
};
