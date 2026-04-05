import { useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { getReferenceImagesByIds, saveImage, saveReferenceImage } from "~/lib/db";
import { buildGenerationSignature } from "~/lib/generationSignature";
import { getModel } from "~/lib/models";
import { createThumbnailBlob, getImageDimensions } from "~/lib/imageProcessing";
import type { ApiKeys, AspectRatio, GalleryItem, Provider, Resolution } from "~/types";
import { GoogleGenAI } from "@google/genai";
import Replicate from "replicate";
import { blobToBase64, sleep } from "../lib/util";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

interface GenerationTask {
  id: string;
  modelId: string;
  modelName: string;
  provider: Provider;
  prompt: string;
  aspectRatio: AspectRatio | null;
  resolution: Resolution | null;
  referenceImages: Array<{ id: string; blob: Blob }>;
}

// Custom error class for rate limiting
class RateLimitError extends Error {
  retryAfter: number;
  
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export function useImageGeneration() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const models = useSettingsStore((s) => s.models);
  const incrementRequestedOutputCount = useSettingsStore((s) => s.incrementRequestedOutputCount);

  const prompt = useGalleryStore((s) => s.currentPrompt);
  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const aspectRatio = useGalleryStore((s) => s.currentAspectRatio);
  const resolution = useGalleryStore((s) => s.currentResolution);
  const referenceImages = useGalleryStore((s) => s.currentReferenceImages);
  const addItems = useGalleryStore((s) => s.addItems);
  const updateItem = useGalleryStore((s) => s.updateItem);
  const startGeneration = useGalleryStore((s) => s.startGeneration);
  const finishGeneration = useGalleryStore((s) => s.finishGeneration);
  const getItem = useGalleryStore((s) => s.getItem);

  const persistReferences = useCallback(async (images: Array<{ id: string; blob: Blob; name: string }>) => {
    await Promise.all(
      images.map(async (image) => {
        const saved = await saveReferenceImage(image);
        URL.revokeObjectURL(saved.url);
      })
    );
  }, []);

  // Execute a single generation with retry logic
  const executeWithRetry = useCallback(async (
    task: GenerationTask,
    apiKeys: ApiKeys,
    retryCount: number = 0
  ): Promise<{ blob: Blob; width: number; height: number; metadata: Record<string, unknown> }> => {
    try {
      return await executeGeneration(task, apiKeys);
    } catch (error) {
      // Handle rate limiting - wait and retry indefinitely
      if (error instanceof RateLimitError) {
        const waitMs = error.retryAfter * 1000;
        const waitUntil = Date.now() + waitMs;
        
        updateItem(task.id, { 
          status: "waiting", 
          retryCount,
          waitingUntil: waitUntil,
          retryAfter: error.retryAfter
        });
        
        await sleep(waitMs);
        
        // After waiting, try again (don't increment retry count for rate limits)
        updateItem(task.id, { status: "generating", retryCount });
        return executeWithRetry(task, apiKeys, retryCount);
      }
      
      // Handle other errors with exponential backoff, up to MAX_RETRIES
      if (retryCount < MAX_RETRIES) {
        const backoffMs = BASE_BACKOFF_MS * Math.pow(2, retryCount);
        const waitUntil = Date.now() + backoffMs;
        
        updateItem(task.id, { 
          status: "waiting", 
          retryCount: retryCount + 1,
          waitingUntil: waitUntil,
          retryAfter: Math.ceil(backoffMs / 1000)
        });
        
        await sleep(backoffMs);
        
        updateItem(task.id, { status: "generating", retryCount: retryCount + 1 });
        return executeWithRetry(task, apiKeys, retryCount + 1);
      }
      
      // Max retries exceeded, throw the error
      throw error;
    }
  }, [updateItem]);

  // Retry a failed item
  const retryItem = useCallback(async (itemId: string) => {
    const item = getItem(itemId);
    if (!item || item.status !== 'failed') return;

    const model = getModel(models, item.modelId);
    if (!model) return;

    const persistedReferences = await getReferenceImagesByIds(item.referenceImageIds);

    const task: GenerationTask = {
      id: itemId,
      modelId: item.modelId,
      modelName: item.modelName,
      provider: model.provider,
      prompt: item.prompt,
      aspectRatio: item.aspectRatio,
      resolution: item.resolution,
      referenceImages: persistedReferences.map((referenceImage) => ({
        id: referenceImage.id,
        blob: referenceImage.blob,
      })),
    };

    incrementRequestedOutputCount(1);
    updateItem(itemId, { status: "generating" });

    try {
      const result = await executeWithRetry(task, apiKeys, 0);
      const thumbnailBlob = await createThumbnailBlob(result.blob, 400);
      const createdAt = Date.now();

      await saveImage({
        originalBlob: result.blob,
        thumbnailBlob,
        prompt: task.prompt,
        modelId: task.modelId,
        modelName: task.modelName,
        aspectRatio: task.aspectRatio,
        resolution: task.resolution,
        width: result.width,
        height: result.height,
        createdAt,
        referenceImageIds: task.referenceImages.map((referenceImage) => referenceImage.id),
        metadata: result.metadata,
      });

      updateItem(itemId, {
        status: "completed",
        originalBlob: result.blob,
        originalUrl: URL.createObjectURL(result.blob),
        thumbnailBlob,
        thumbnailUrl: URL.createObjectURL(thumbnailBlob),
        width: result.width,
        height: result.height,
        createdAt,
        metadata: result.metadata,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      updateItem(itemId, { status: "failed", error: message, canRetry: true });
    }
  }, [apiKeys, models, getItem, updateItem, executeWithRetry, incrementRequestedOutputCount]);

  const generate = useCallback(async () => {
    const signature = buildGenerationSignature({
      prompt,
      modelSelections,
      aspectRatio,
      resolution,
      referenceImages,
    });

    // Build tasks for each model/count
    const tasks: GenerationTask[] = [];
    const pendingItems: GalleryItem[] = [];

    for (const [modelId, count] of Object.entries(modelSelections)) {
      if (count === 0) continue;

      const model = getModel(models, modelId);
      if (!model) continue;

      for (let i = 0; i < count; i++) {
        const taskId = crypto.randomUUID();
        const taskResolution = model.capabilities.supportsResolution ? resolution : null;
        const taskAspectRatio = model.capabilities.supportsAspectRatios ? aspectRatio : null;

        tasks.push({
          id: taskId,
          modelId,
          modelName: model.name,
          provider: model.provider,
          prompt,
          aspectRatio: taskAspectRatio,
          resolution: taskResolution,
          referenceImages: referenceImages.map((r) => ({ id: r.id, blob: r.blob })),
        });

        pendingItems.push({
          id: taskId,
          status: "pending",
          modelId,
          modelName: model.name,
          prompt,
          aspectRatio: taskAspectRatio,
          resolution: taskResolution,
          referenceImageIds: referenceImages.map((r) => r.id),
          retryCount: 0,
        });
      }
    }

    if (tasks.length === 0) return;

    incrementRequestedOutputCount(tasks.length);

    await persistReferences(
      referenceImages.map((image) => ({
        id: image.id,
        blob: image.blob,
        name: image.name,
      }))
    );

    // Add pending items to gallery immediately
    addItems(pendingItems);
    startGeneration(signature);

    try {
      // Execute all tasks in parallel
      const results = await Promise.allSettled(
        tasks.map(async (task) => {
          updateItem(task.id, { status: "generating" });

          try {
            const result = await executeWithRetry(task, apiKeys, 0);
            const thumbnailBlob = await createThumbnailBlob(result.blob, 400);
            const createdAt = Date.now();

            // Save to IndexedDB
            await saveImage({
              originalBlob: result.blob,
              thumbnailBlob,
              prompt: task.prompt,
              modelId: task.modelId,
              modelName: task.modelName,
              aspectRatio: task.aspectRatio,
              resolution: task.resolution,
              width: result.width,
              height: result.height,
              createdAt,
              referenceImageIds: task.referenceImages.map((referenceImage) => referenceImage.id),
              metadata: result.metadata,
            });

            // Update item to completed status with image data
            updateItem(task.id, {
              status: "completed",
              originalBlob: result.blob,
              originalUrl: URL.createObjectURL(result.blob),
              thumbnailBlob,
              thumbnailUrl: URL.createObjectURL(thumbnailBlob),
              width: result.width,
              height: result.height,
              createdAt,
              metadata: result.metadata,
            });

            return result;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Generation failed";
            updateItem(task.id, { status: "failed", error: message, canRetry: true });
            throw error;
          }
        })
      );

      return results;
    } finally {
      finishGeneration(signature);
    }
  }, [
    prompt,
    modelSelections,
    aspectRatio,
    resolution,
    referenceImages,
    apiKeys,
    models,
    addItems,
    updateItem,
    startGeneration,
    finishGeneration,
    executeWithRetry,
    persistReferences,
    incrementRequestedOutputCount,
  ]);

  return { generate, retryItem };
}

async function executeGeneration(
  task: GenerationTask,
  apiKeys: ApiKeys
): Promise<{ blob: Blob; width: number; height: number; metadata: Record<string, unknown> }> {
  const apiKey = apiKeys[task.provider];
  if (!apiKey) throw new Error(`No API key for ${task.provider}`);

  // For Google models, use direct API call
  if (task.provider === "google") {
    return executeGoogleGeneration(task, apiKey);
  }

  // For Replicate models
  if (task.provider === "replicate") {
    return executeReplicateGeneration(task, apiKey);
  }

  throw new Error(`Provider ${task.provider} not implemented`);
}

async function executeGoogleGeneration(
  task: GenerationTask,
  apiKey: string
): Promise<{ blob: Blob; width: number; height: number; metadata: Record<string, unknown> }> {
  const ai = new GoogleGenAI({ apiKey });

  // Build parts array
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  // Add reference images if any
  for (const ref of task.referenceImages) {
    const base64 = await blobToBase64(ref.blob);
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: base64.split(",")[1], // Remove data:image/png;base64, prefix
      },
    });
  }

  // Add the prompt
  parts.push({ text: task.prompt });

  const contents = [
    {
      role: "user",
      parts,
    },
  ];

  const config = {
    responseModalities: ["IMAGE"],
    ...(task.aspectRatio || task.resolution
      ? {
          imageConfig: {
            ...(task.aspectRatio && { aspectRatio: task.aspectRatio }),
            ...(task.resolution && { imageSize: task.resolution }),
          },
        }
      : {}),
  };

  let response;
  try {
    response = await ai.models.generateContentStream({
      model: task.modelId,
      config,
      contents,
    });
  } catch (error) {
    // Check for rate limit error (429)
    if (error instanceof Error) {
      const errorAny = error as { status?: number; code?: number; message?: string };
      if (errorAny.status === 429 || errorAny.code === 429 || errorAny.message?.includes('429') || errorAny.message?.toLowerCase().includes('rate limit')) {
        // Try to extract retry-after from error
        let retryAfter = 10; // Default to 10 seconds
        const retryMatch = errorAny.message?.match(/retry.?after[:\s]*(\d+)/i);
        if (retryMatch) {
          retryAfter = Math.ceil(parseInt(retryMatch[1], 10));
        }
        throw new RateLimitError(`Rate limited by ${task.provider}`, retryAfter);
      }
    }
    throw error;
  }

  let imageBlob: Blob | null = null;
  let modelVersion: string | undefined;

  for await (const chunk of response) {
    if (!chunk.candidates?.[0]?.content?.parts) {
      continue;
    }

    const inlineData = chunk.candidates[0].content.parts[0]?.inlineData;
    if (inlineData?.data && inlineData?.mimeType) {
      // Convert base64 to blob
      const binaryString = atob(inlineData.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageBlob = new Blob([bytes], { type: inlineData.mimeType });
    }

    if (chunk.modelVersion) {
      modelVersion = chunk.modelVersion;
    }
  }

  if (!imageBlob) {
    throw new Error("No image in response");
  }

  // Get dimensions from the image
  const dimensions = await getImageDimensions(imageBlob);

  return {
    blob: imageBlob,
    width: dimensions.width,
    height: dimensions.height,
    metadata: {
      modelVersion,
    },
  };
}

async function executeReplicateGeneration(
  task: GenerationTask,
  apiKey: string
): Promise<{ blob: Blob; width: number; height: number; metadata: Record<string, unknown> }> {
  const baseUrl = new URL("/proxy/replicate/v1", window.location.origin).toString();
  const replicate = new Replicate({ auth: apiKey, baseUrl });

  // Convert reference image blobs to data URIs
  const imageInputs = await Promise.all(
    task.referenceImages.map(async (ref) => blobToBase64(ref.blob))
  );

  // Look up schema mapping for this model
  const model = useSettingsStore.getState().models.find((m) => m.id === task.modelId);
  const mapping = model?.schemaMapping;

  // Build input payload
  const input: Record<string, unknown> = {
    prompt: task.prompt,
    output_format: "png",
  };
  if (task.aspectRatio) {
    input.aspect_ratio = task.aspectRatio;
  }
  if (imageInputs.length > 0) {
    const imageKey = mapping?.imageInputKey ?? "image_input";
    input[imageKey] = imageInputs;
  }
  if (task.resolution) {
    input.resolution = mapping?.resolution?.[task.resolution] ?? task.resolution;
  }

  // Apply extra defaults (don't override explicit values)
  if (mapping?.extraDefaults) {
    for (const [key, value] of Object.entries(mapping.extraDefaults)) {
      if (!(key in input)) {
        input[key] = value;
      }
    }
  }

  const replicateModel = task.modelId.replace("replicate/", "") as `${string}/${string}`;

  let output;
  try {
    output = await replicate.run(replicateModel, { input });
  } catch (error) {
    // Check for rate limit error (429)
    if (error instanceof Error) {
      // Replicate SDK throws errors with response info
      const errorAny = error as { status?: number; response?: Response; message?: string };
      
      // Check if it's a 429 error
      if (errorAny.status === 429 || errorAny.message?.includes('429')) {
        // Try to parse retry_after from the error message
        let retryAfter = 10; // Default to 10 seconds
        try {
          const jsonMatch = errorAny.message?.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.retry_after) {
              retryAfter = Math.ceil(parsed.retry_after);
            }
          }
        } catch {
          // Use default retry_after
        }
        throw new RateLimitError(`Rate limited by ${task.provider}`, retryAfter);
      }
    }
    throw error;
  }

  // Get the image URL from the output
  const imageUrl = typeof output === "object" && output !== null && "url" in output
    ? (output as { url: () => string }).url()
    : Array.isArray(output)
      ? output[0]
      : String(output);

  if (!imageUrl) {
    throw new Error("No image in Replicate response");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);
  }

  const blob = await imageResponse.blob();
  const dimensions = await getImageDimensions(blob);

  return {
    blob,
    width: dimensions.width,
    height: dimensions.height,
    metadata: {},
  };
}
