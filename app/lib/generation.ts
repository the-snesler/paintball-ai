import { GoogleGenAI } from "@google/genai";
import Replicate from "replicate";
import { useSettingsStore } from "~/stores/settingsStore";
import type { AspectRatio, Resolution } from "~/types";
import { blobToBase64 } from "./util";
import { getImageDimensions } from "./imageProcessing";

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
  provider: "google" | "replicate";
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
  apiKey: string
): Promise<GenerationResult> {
  if (params.provider === "google") return generateWithGoogle(params, apiKey);
  if (params.provider === "replicate") return generateWithReplicate(params, apiKey);
  throw new Error(`Provider ${params.provider} not implemented`);
}

export async function generateWithGoogle(
  params: GenerationParams,
  apiKey: string
): Promise<GenerationResult> {
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
    if (error instanceof Error) {
      const errorAny = error as { status?: number; code?: number; message?: string };
      if (
        errorAny.status === 429 ||
        errorAny.code === 429 ||
        errorAny.message?.includes("429") ||
        errorAny.message?.toLowerCase().includes("rate limit")
      ) {
        let retryAfter = 10;
        const retryMatch = errorAny.message?.match(/retry.?after[:\s]*(\d+)/i);
        if (retryMatch) retryAfter = Math.ceil(parseInt(retryMatch[1], 10));
        throw new RateLimitError(`Rate limited by google`, retryAfter);
      }
    }
    throw error;
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
  apiKey: string
): Promise<GenerationResult> {
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
  if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
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
    if (error instanceof Error) {
      const errorAny = error as { status?: number; message?: string };
      if (errorAny.status === 429 || errorAny.message?.includes("429")) {
        let retryAfter = 10;
        try {
          const jsonMatch = errorAny.message?.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.retry_after) retryAfter = Math.ceil(parsed.retry_after);
          }
        } catch {
          /* use default */
        }
        throw new RateLimitError(`Rate limited by replicate`, retryAfter);
      }
    }
    throw error;
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
