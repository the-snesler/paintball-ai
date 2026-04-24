import OpenAI, { toFile } from "openai";
import { distance } from "fastest-levenshtein";
import type { GenerationParams, GenerationResult } from "~/lib/generation";
import { getImageDimensions } from "~/lib/imageProcessing";
import { toRateLimitError } from "~/lib/retry";
import type { AspectRatio } from "~/types";
import type { Provider, SearchResult } from "./types";

/**
 * Maps the app's aspect-ratio strings onto OpenAI's fixed set of image sizes.
 * GPT image models only accept `1024x1024` (1:1), `1536x1024` (landscape 3:2),
 * `1024x1536` (portrait 2:3), or `auto`.
 */
type OpenAISize = "1024x1024" | "1536x1024" | "1024x1536" | "auto";

function aspectRatioToSize(aspectRatio: AspectRatio | null): OpenAISize {
  if (!aspectRatio) return "auto";
  switch (aspectRatio) {
    case "1:1":
      return "1024x1024";
    case "3:2":
      return "1536x1024";
    case "2:3":
      return "1024x1536";
    default:
      return "auto";
  }
}

type OpenAIQuality = "low" | "medium" | "high" | "auto";

function normalizeQuality(value: string | null): OpenAIQuality | undefined {
  if (!value) return undefined;
  if (value === "low" || value === "medium" || value === "high" || value === "auto") {
    return value;
  }
  return undefined;
}

function buildClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

async function blobToUploadable(blob: Blob, index: number): Promise<File> {
  const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
  return toFile(blob, `reference-${index}.${ext}`, {
    type: blob.type || "image/png",
  });
}

function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function generateImage(
  params: GenerationParams,
  apiKey?: string
): Promise<GenerationResult[]> {
  if (!apiKey) throw new Error("No API key for openai");
  const client = buildClient(apiKey);

  const size = aspectRatioToSize(params.aspectRatio);
  const quality = normalizeQuality(params.quality);
  // OpenAI caps `n` at 10, and our UI already respects `maxImagesPerRequest` —
  // clamp defensively in case a stale model definition slips through.
  const n = Math.max(1, Math.min(10, params.numberOfImages || 1));

  let response;
  try {
    if (params.referenceImages.length > 0) {
      const images = await Promise.all(
        params.referenceImages.map((ref, i) => blobToUploadable(ref.blob, i))
      );
      response = await client.images.edit({
        model: params.modelId,
        prompt: params.prompt,
        image: images,
        size,
        n,
        ...(quality && { quality }),
      });
    } else {
      response = await client.images.generate({
        model: params.modelId,
        prompt: params.prompt,
        size,
        n,
        ...(quality && { quality }),
      });
    }
  } catch (error) {
    throw toRateLimitError(error, "openai");
  }

  const items = response.data ?? [];
  if (items.length === 0) throw new Error("No image in OpenAI response");

  // GPT image models always return base64; `output_format` decides the MIME
  // type. We don't set it, so the API default (`png`) applies.
  const mime = "image/png";

  return Promise.all(
    items.map(async (item) => {
      if (!item.b64_json) throw new Error("OpenAI response missing b64_json");
      const blob = base64ToBlob(item.b64_json, mime);
      const dimensions = await getImageDimensions(blob);
      return {
        blob,
        width: dimensions.width,
        height: dimensions.height,
        metadata: {},
      };
    })
  );
}

async function searchImageModels(query: string, apiKey: string): Promise<SearchResult[]> {
  const client = buildClient(apiKey);
  let models;
  try {
    const response = await client.models.list();
    models = response.data ?? [];
  } catch {
    return [];
  }

  const imageModels = models.filter((m) => /^(gpt-image|dall-e)/i.test(m.id));
  const q = query.toLowerCase();
  const scored = imageModels
    .map((m) => {
      const id = m.id.toLowerCase();
      const containsBoost = id.includes(q) ? -1000 : 0;
      return { model: m, score: distance(q, id) + containsBoost };
    })
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, 6).map(({ model }) => ({
    id: model.id,
    name: model.id,
    icon: "/icons/openai.svg",
  }));
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
