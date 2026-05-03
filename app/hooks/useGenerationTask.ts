import { useCallback } from "react";
import { getReferenceImagesByIds, saveImage } from "~/lib/db";
import { enqueueImageEmbedding } from "~/lib/embeddingQueue";
import { executeGeneration, type GenerationResult } from "~/lib/generation";
import { createThumbnailBlob } from "~/lib/imageProcessing";
import { getModel } from "~/lib/models";
import { providerRequiresApiKey } from "~/lib/providers";
import { retryWithBackoff } from "~/lib/retry";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import type { AspectRatio, Provider, Resolution } from "~/types";

export interface GenerationTask {
  /** Gallery item IDs this task produces. Length 1 for single-image models,
   *  greater for batch-capable models called with numberOfImages > 1. */
  itemIds: string[];
  modelId: string;
  modelName: string;
  provider: Provider;
  prompt: string;
  basePrompt?: string;
  variationReplacements?: string[];
  aspectRatio: AspectRatio | null;
  resolution: Resolution | null;
  quality: string | null;
  numberOfImages: number;
  referenceImages: Array<{ id: string; blob: Blob; sourceGalleryItemId?: string }>;
}

interface RunTaskOptions {
  useRetry?: boolean;
  getCanRetry?: (error: unknown, task: GenerationTask) => boolean;
}

export function useGenerationTask() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const models = useSettingsStore((s) => s.models);
  const incrementRequestedOutputCount = useSettingsStore((s) => s.incrementRequestedOutputCount);
  const updateItem = useGalleryStore((s) => s.updateItem);
  const getItem = useGalleryStore((s) => s.getItem);

  const updateAll = useCallback(
    (ids: string[], patch: Parameters<typeof updateItem>[1]) => {
      for (const id of ids) updateItem(id, patch);
    },
    [updateItem]
  );

  const executeTask = useCallback(
    async (task: GenerationTask): Promise<GenerationResult[]> => {
      const apiKey = providerRequiresApiKey(task.provider) ? apiKeys[task.provider] : undefined;
      if (providerRequiresApiKey(task.provider) && !apiKey) {
        throw new Error(`No API key for ${task.provider}`);
      }

      return executeGeneration(
        {
          modelId: task.modelId,
          provider: task.provider,
          prompt: task.prompt,
          aspectRatio: task.aspectRatio,
          resolution: task.resolution,
          quality: task.quality,
          numberOfImages: task.numberOfImages,
          referenceImages: task.referenceImages,
          itemIds: task.itemIds,
        },
        apiKey || undefined
      );
    },
    [apiKeys]
  );

  const executeWithRetry = useCallback(
    (task: GenerationTask) =>
      retryWithBackoff(() => executeTask(task), {
        onWaiting: ({ retryCount, waitMs, waitingUntil }) => {
          updateAll(task.itemIds, {
            status: "waiting",
            retryCount,
            waitingUntil,
            retryAfter: Math.ceil(waitMs / 1000),
          });
        },
        onRetrying: ({ retryCount }) => {
          updateAll(task.itemIds, { status: "generating", retryCount });
        },
      }),
    [executeTask, updateAll]
  );

  const completeTask = useCallback(
    async (task: GenerationTask, results: GenerationResult[], generationTimeMs: number) => {
      const parentGalleryItemIds = task.referenceImages
        .map((r) => r.sourceGalleryItemId)
        .filter((id): id is string => !!id);

      const createdAt = Date.now();

      // Pair each expected itemId with a result; fail the extras if fewer results arrived.
      await Promise.all(
        task.itemIds.map(async (itemId, index) => {
          const result = results[index];
          if (!result) {
            updateItem(itemId, {
              status: "failed",
              error: "Model returned fewer images than requested",
              canRetry: true,
            });
            return;
          }

          const thumbnailBlob = await createThumbnailBlob(result.blob, 400);

          await saveImage({
            id: itemId,
            originalBlob: result.blob,
            thumbnailBlob,
            prompt: task.prompt,
            basePrompt: task.basePrompt,
            variationReplacements: task.variationReplacements,
            modelId: task.modelId,
            modelName: task.modelName,
            aspectRatio: task.aspectRatio,
            resolution: task.resolution,
            quality: task.quality,
            width: result.width,
            height: result.height,
            createdAt,
            generationTimeMs,
            referenceImageIds: task.referenceImages.map((r) => r.id),
            parentGalleryItemIds: parentGalleryItemIds.length > 0 ? parentGalleryItemIds : undefined,
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
            generationTimeMs,
            referenceImageIds: task.referenceImages.map((r) => r.id),
            metadata: result.metadata,
            parentGalleryItemIds: parentGalleryItemIds.length > 0 ? parentGalleryItemIds : undefined,
          });

          enqueueImageEmbedding(itemId);
        })
      );

      return results;
    },
    [updateItem]
  );

  const runTask = useCallback(
    async (task: GenerationTask, options: RunTaskOptions = {}) => {
      const { useRetry = true, getCanRetry = () => true } = options;
      updateAll(task.itemIds, { status: "generating" });

      try {
        const startTime = Date.now();
        const results = useRetry ? await executeWithRetry(task) : await executeTask(task);
        return await completeTask(task, results, Date.now() - startTime);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed";
        updateAll(task.itemIds, {
          status: "failed",
          error: message,
          canRetry: getCanRetry(error, task),
        });
        throw error;
      }
    },
    [completeTask, executeTask, executeWithRetry, updateAll]
  );

  const runTasks = useCallback(
    async (
      tasks: GenerationTask[],
      options: RunTaskOptions = {}
    ): Promise<PromiseSettledResult<GenerationResult[]>[]> => {
      if (tasks.length === 0) return [];

      const totalItems = tasks.reduce((sum, t) => sum + t.itemIds.length, 0);
      incrementRequestedOutputCount(totalItems);

      return Promise.allSettled(
        tasks.map((task) =>
          runTask(task, {
            useRetry: options.useRetry,
            getCanRetry: options.getCanRetry,
          })
        )
      );
    },
    [incrementRequestedOutputCount, runTask]
  );

  const retryItem = useCallback(
    async (itemId: string) => {
      const item = getItem(itemId);
      if (!item || item.status !== "failed") return;

      const model = getModel(models, item.modelId);
      if (!model) return;

      const persistedReferences = await getReferenceImagesByIds(item.referenceImageIds);
      const task: GenerationTask = {
        itemIds: [itemId],
        modelId: item.modelId,
        modelName: item.modelName,
        provider: model.provider,
        prompt: item.prompt,
        basePrompt: item.basePrompt,
        variationReplacements: item.variationReplacements,
        aspectRatio: item.aspectRatio,
        resolution: item.resolution,
        quality: item.quality ?? null,
        numberOfImages: 1,
        referenceImages: persistedReferences.map((referenceImage) => ({
          id: referenceImage.id,
          blob: referenceImage.blob,
        })),
      };

      incrementRequestedOutputCount(1);
      await runTask(task);
    },
    [getItem, incrementRequestedOutputCount, models, runTask]
  );

  return { runTasks, retryItem };
}
