import { GoogleGenAI, ThinkingLevel, type Model } from "@google/genai";
import { distance } from "fastest-levenshtein";
import type { GenerationParams, GenerationResult } from "~/lib/generation";
import { getImageDimensions } from "~/lib/imageProcessing";
import { toRateLimitError } from "~/lib/retry";
import { blobToBase64 } from "~/lib/util";
import type { Provider, SearchResult, TextGenerationArgs } from "./types";

async function generateImage(
  params: GenerationParams,
  apiKey?: string
): Promise<GenerationResult[]> {
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

  return [
    {
      blob: imageBlob,
      width: dimensions.width,
      height: dimensions.height,
      metadata: { modelVersion },
    },
  ];
}

async function generateText(args: TextGenerationArgs, apiKey: string): Promise<string> {
  const { modelId, systemPrompt, userPrompt, images, prefill } = args;
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (images?.length) {
    for (const blob of images) {
      const base64 = await blobToBase64(blob);
      parts.push({
        inlineData: {
          mimeType: blob.type || "image/png",
          data: base64.split(",")[1],
        },
      });
    }
  }

  parts.push({ text: userPrompt });

  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  }> = [{ role: "user", parts }];

  if (prefill) {
    contents.push({ role: "model", parts: [{ text: prefill }] });
  }

  let response;
  try {
    response = await ai.models.generateContent({
      model: modelId,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
      contents,
    });
  } catch (error) {
    throw toRateLimitError(error, "google");
  }

  const text = response.text;
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

const MAX_LIST_PAGES = 5;

async function listGeminiModels(apiKey: string): Promise<Model[]> {
  const ai = new GoogleGenAI({ apiKey });
  const pager = await ai.models.list({ config: { queryBase: true, pageSize: 200 } });
  const models: Model[] = [];
  let pages = 0;
  for await (const model of pager) {
    models.push(model);
    // Prevent runaway iteration on very long lists — a handful of pages covers
    // every Gemini model that's ever been publicly offered.
    if (++pages >= MAX_LIST_PAGES * 200) break;
  }
  return models;
}

function stripModelsPrefix(name: string | undefined): string {
  if (!name) return "";
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

function isImageGenerationModel(model: Model): boolean {
  const id = stripModelsPrefix(model.name).toLowerCase();
  if (!id) return false;
  // Gemini image generation still uses `generateContent`, so action flags
  // can't distinguish image from text. Go by naming convention.
  return /(^|[-_\/])(image|imagen)([-_\/]|$)/.test(id) || id.includes("-image-");
}

function isTextGenerationModel(model: Model): boolean {
  const id = stripModelsPrefix(model.name);
  if (!id) return false;
  if (!model.supportedActions?.some((a) => a === "generateContent")) return false;
  if (isImageGenerationModel(model)) return false;
  // Exclude embedding / vision-only / TTS / audio flavors that share generateContent.
  const lower = id.toLowerCase();
  if (/embed|tts|audio|live|native-audio/.test(lower)) return false;
  return true;
}

function toSearchResult(model: Model): SearchResult {
  const id = stripModelsPrefix(model.name);
  return {
    id,
    name: model.displayName || id,
    description: model.description,
    icon: "/icons/google.svg",
  };
}

function rankAndLimit(
  models: Model[],
  query: string,
  limit = 6
): SearchResult[] {
  const q = query.toLowerCase();
  const scored = models
    .map((m) => {
      const id = stripModelsPrefix(m.name).toLowerCase();
      const name = (m.displayName || "").toLowerCase();
      const containsBoost = id.includes(q) || name.includes(q) ? -1000 : 0;
      const d = Math.min(distance(q, id), distance(q, name));
      return { model: m, score: d + containsBoost };
    })
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, limit).map(({ model }) => toSearchResult(model));
}

async function searchImageModels(query: string, apiKey: string): Promise<SearchResult[]> {
  const all = await listGeminiModels(apiKey);
  const imageModels = all.filter(isImageGenerationModel);
  return rankAndLimit(imageModels, query);
}

async function searchTextModels(query: string, apiKey: string): Promise<SearchResult[]> {
  const all = await listGeminiModels(apiKey);
  const textModels = all.filter(isTextGenerationModel);
  return rankAndLimit(textModels, query);
}

export const googleProvider: Provider = {
  id: "google",
  label: "Google",
  iconPath: "/icons/google.svg",
  requiresApiKey: true,
  supportsTextPrefill: true,
  capabilities: {
    image: true,
    text: true,
    upscale: false,
    searchImage: true,
    searchText: true,
    searchUpscale: false,
    resolveImageModel: false,
  },
  generateImage,
  generateText,
  testTextModel,
  searchImageModels,
  searchTextModels,
};
