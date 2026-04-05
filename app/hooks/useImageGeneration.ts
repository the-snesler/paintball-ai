import { useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { getReferenceImagesByIds, saveImage, saveReferenceImage } from "~/lib/db";
import { buildGenerationSignature } from "~/lib/generationSignature";
import { getModel } from "~/lib/models";
import { createThumbnailBlob } from "~/lib/imageProcessing";
import type { ApiKeys, AspectRatio, GalleryItem, Provider, Resolution } from "~/types";
import { executeGeneration, RateLimitError } from "~/lib/generation";
import { sleep } from "../lib/util";

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

  const persistReferences = useCallback(
    async (images: Array<{ id: string; blob: Blob; name: string }>) => {
      await Promise.all(
        images.map(async (image) => {
          const saved = await saveReferenceImage(image);
          URL.revokeObjectURL(saved.url);
        })
      );
    },
    []
  );

  // Execute a single generation with retry logic
  const executeWithRetry = useCallback(
    async (
      task: GenerationTask,
      apiKeys: ApiKeys,
      retryCount: number = 0
    ): Promise<{
      blob: Blob;
      width: number;
      height: number;
      metadata: Record<string, unknown>;
    }> => {
      try {
        return await executeGenerationTask(task, apiKeys);
      } catch (error) {
        // Handle rate limiting - wait and retry indefinitely
        if (error instanceof RateLimitError) {
          const waitMs = error.retryAfter * 1000;
          const waitUntil = Date.now() + waitMs;

          updateItem(task.id, {
            status: "waiting",
            retryCount,
            waitingUntil: waitUntil,
            retryAfter: error.retryAfter,
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
            retryAfter: Math.ceil(backoffMs / 1000),
          });

          await sleep(backoffMs);

          updateItem(task.id, { status: "generating", retryCount: retryCount + 1 });
          return executeWithRetry(task, apiKeys, retryCount + 1);
        }

        // Max retries exceeded, throw the error
        throw error;
      }
    },
    [updateItem]
  );

  // Retry a failed item
  const retryItem = useCallback(
    async (itemId: string) => {
      const item = getItem(itemId);
      if (!item || item.status !== "failed") return;

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
    },
    [apiKeys, models, getItem, updateItem, executeWithRetry, incrementRequestedOutputCount]
  );

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

async function executeGenerationTask(
  task: GenerationTask,
  apiKeys: ApiKeys
): Promise<{ blob: Blob; width: number; height: number; metadata: Record<string, unknown> }> {
  const apiKey = apiKeys[task.provider];
  if (!apiKey) throw new Error(`No API key for ${task.provider}`);

  return executeGeneration(
    {
      modelId: task.modelId,
      provider: task.provider,
      prompt: task.prompt,
      aspectRatio: task.aspectRatio,
      resolution: task.resolution,
      referenceImages: task.referenceImages,
    },
    apiKey
  );
}
