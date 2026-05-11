import OpenAI, { toFile } from "openai";
import { distance } from "fastest-levenshtein";
import type { GenerationParams, GenerationResult } from "~/lib/generation";
import { getImageDimensions } from "~/lib/imageProcessing";
import { toRateLimitError } from "~/lib/retry";
import { blobToBase64 } from "~/lib/util";
import type { AspectRatio, Resolution } from "~/types";
import type { Provider, ResolvedImageModel, SearchResult, TextGenerationArgs } from "./types";
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

type ResponseInputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" };

async function generateText(args: TextGenerationArgs, apiKey: string): Promise<string> {
  let { userPrompt } = args;
  const { systemPrompt, images, prefill } = args;
  const modelId = normalizeModelId(args.modelId, "openai");
  const client = createClient(apiKey);

  // OpenAI models don't reliably continue from a partial assistant turn the way
  // Gemini does — they treat assistant input as completed history. Fall back to
  // the Replicate strategy of folding the prefill into the user prompt.
  if (prefill) {
    userPrompt = userPrompt + "\n\n" + prefill;
  }

  const content: ResponseInputContent[] = [{ type: "input_text", text: userPrompt }];

  if (images?.length) {
    for (const blob of images) {
      const dataUrl = await blobToBase64(blob);
      content.push({ type: "input_image", image_url: dataUrl, detail: "auto" });
    }
  }

  let response;
  try {
    response = await client.responses.create({
      model: modelId,
      instructions: systemPrompt,
      input: [{ role: "user", content }],
    });
  } catch (error) {
    throw toRateLimitError(error, "openai");
  }

  const text = response.output_text;
  if (!text) {
    throw new Error("No text in response");
  }

  if (prefill) {
    return prefill + text;
  }
  return text;
}

async function testTextModel(apiKey: string, modelId: string): Promise<void> {
  await generateText(
    {
      modelId,
      systemPrompt: "You are a connectivity test.",
      userPrompt: "Respond with the single word 'hi' and nothing else.",
    },
    apiKey
  );
}

// OpenAI's /v1/models endpoint doesn't expose per-capability flags, so we filter
// by naming convention. The goal is to allow general-purpose chat/reasoning
// models and exclude specialized non-text endpoints (images, embeddings, audio,
// transcription, TTS, realtime, moderation).
function isTextModel(model: OpenAIModel): boolean {
  const id = model.id.toLowerCase();
  if (/(^|[-_])(gpt-image|dall-e)/.test(id)) return false;
  if (/(^|[-_])embedding/.test(id)) return false;
  if (/(^|[-_])(whisper|tts|transcribe|audio|realtime|moderation)/.test(id)) return false;
  // Specialized variants that don't use the standard Responses interface cleanly.
  if (/(^|[-_])(search-preview|computer-use|deep-research)/.test(id)) return false;
  // Allow generic gpt-*, chatgpt-*, codex-*, and reasoning models (o1/o3/o4 plus
  // any future o<N>* family). Tolerate "*-mini", "*-pro", "*-nano", date suffixes.
  return /^(gpt-|chatgpt-|codex-|o\d)/.test(id);
}

function toTextSearchResult(model: OpenAIModel): SearchResult {
  return {
    id: model.id,
    name: inferName(model.id),
    description: model.owned_by ? `Owner: ${model.owned_by}` : "OpenAI text model",
    icon: "/icons/openai.svg",
  };
}

async function searchTextModels(query: string, apiKey: string): Promise<SearchResult[]> {
  const client = createClient(apiKey);

  let models: OpenAIModel[] = [];
  try {
    const response = await client.models.list();
    models = response.data as OpenAIModel[];
  } catch {
    return [];
  }

  const textModels = models.filter(isTextModel);
  const q = query.trim().toLowerCase();

  if (!q) {
    return textModels.slice(0, 6).map(toTextSearchResult);
  }

  return textModels
    .map((model) => {
      const id = model.id.toLowerCase();
      const containsBoost = id.includes(q) ? -1000 : 0;
      const score = distance(q, id) + containsBoost;
      return { model, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map(({ model }) => toTextSearchResult(model));
}

export const openaiProvider: Provider = {
  id: "openai",
  label: "OpenAI",
  iconPath: "/icons/openai.svg",
  requiresApiKey: true,
  supportsTextPrefill: false,
  capabilities: {
    image: true,
    text: true,
    upscale: false,
    searchImage: true,
    searchText: true,
    searchUpscale: false,
  },
  generateImage,
  generateText,
  testTextModel,
  searchImageModels,
  searchTextModels,
  resolveImageModel,
};
