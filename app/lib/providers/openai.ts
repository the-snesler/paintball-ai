import OpenAI, { toFile } from "openai";
import { distance } from "fastest-levenshtein";
import type { GenerationParams, GenerationResult } from "~/lib/generation";
import { getImageDimensions } from "~/lib/imageProcessing";
import { toRateLimitError } from "~/lib/retry";
import type { AspectRatio } from "~/types";
import type { Provider, SearchResult } from "./types";
import { inferName } from "../modelNames";

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

// OpenAI image models accept a fixed set of size strings (or "auto").
// gpt-image-2 supports flexible dimensions in addition, but we stick to the
// shared preset enum so the app's aspect-ratio picker maps cleanly.
const ASPECT_RATIO_TO_SIZE: Record<string, "1024x1024" | "1536x1024" | "1024x1536"> = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

function resolveSize(aspectRatio: AspectRatio | null): "auto" | "1024x1024" | "1536x1024" | "1024x1536" {
  if (!aspectRatio) return "auto";
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

  const size = resolveSize(params.aspectRatio);
  const n = Math.max(1, params.numberOfImages);
  const outputFormat: "png" | "jpeg" | "webp" = "png";
  const quality = (params.quality ?? undefined) as "low" | "medium" | "high" | "auto" | undefined;

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
        model: params.modelId,
        image: files,
        prompt: params.prompt,
        n,
        size,
        ...(quality ? { quality } : {}),
        output_format: outputFormat,
      });

      return parseResponse(response, outputFormat, params.modelId);
    }

    const response = await client.images.generate({
      model: params.modelId,
      prompt: params.prompt,
      n,
      size,
      ...(quality ? { quality } : {}),
      output_format: outputFormat,
    });

    return parseResponse(response, outputFormat, params.modelId);
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
    resolveImageModel: false,
  },
  generateImage,
  searchImageModels,
};
