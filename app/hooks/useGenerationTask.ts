import { useCallback } from "react";
import { getReferenceImagesByIds, saveImage } from "~/lib/db";
import { executeGeneration, type GenerationResult } from "~/lib/generation";
import { createThumbnailBlob } from "~/lib/imageProcessing";
import { getModel } from "~/lib/models";
import { providerRequiresApiKey } from "~/lib/providers";
import { retryWithBackoff } from "~/lib/retry";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import type { AspectRatio, GalleryItem, Provider, Resolution } from "~/types";

export interface GenerationTask {
  id: string;
  modelId: string;
  modelName: string;
  provider: Provider;
  prompt: string;
  basePrompt?: string;
  variationReplacements?: string[];
  aspectRatio: AspectRatio | null;
  resolution: Resolution | null;
  referenceImages: Array<{ id: string; blob: Blob; sourceGalleryItemId?: string }>;
}

interface RunTaskOptions {
  useRetry?: boolean;
  getCanRetry?: (error: unknown, task: GenerationTask) => boolean;
}

interface RunTasksOptions extends RunTaskOptions {
  onItemsCreated?: (itemIds: string[]) => void;
  /** Set when the caller has already added the pending items to the gallery store. */
  itemsAlreadyAdded?: boolean;
}

export function useGenerationTask() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const models = useSettingsStore((s) => s.models);
  const incrementRequestedOutputCount = useSettingsStore((s) => s.incrementRequestedOutputCount);
  const addItems = useGalleryStore((s) => s.addItems);
  const updateItem = useGalleryStore((s) => s.updateItem);
  const getItem = useGalleryStore((s) => s.getItem);

  const executeTask = useCallback(
    async (task: GenerationTask): Promise<GenerationResult> => {
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
          referenceImages: task.referenceImages,
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
          updateItem(task.id, {
            status: "waiting",
            retryCount,
            waitingUntil,
            retryAfter: Math.ceil(waitMs / 1000),
          });
        },
        onRetrying: ({ retryCount }) => {
          updateItem(task.id, { status: "generating", retryCount });
        },
      }),
    [executeTask, updateItem]
  );

  const completeTask = useCallback(
    async (task: GenerationTask, result: GenerationResult, generationTimeMs: number) => {
      const thumbnailBlob = await createThumbnailBlob(result.blob, 400);
      const createdAt = Date.now();

      const parentGalleryItemIds = task.referenceImages
        .map((r) => r.sourceGalleryItemId)
        .filter((id): id is string => !!id);

      await saveImage({
        id: task.id,
        originalBlob: result.blob,
        thumbnailBlob,
        prompt: task.prompt,
        basePrompt: task.basePrompt,
        variationReplacements: task.variationReplacements,
        modelId: task.modelId,
        modelName: task.modelName,
        aspectRatio: task.aspectRatio,
        resolution: task.resolution,
        width: result.width,
        height: result.height,
        createdAt,
        generationTimeMs,
        referenceImageIds: task.referenceImages.map((referenceImage) => referenceImage.id),
        parentGalleryItemIds: parentGalleryItemIds.length > 0 ? parentGalleryItemIds : undefined,
        metadata: result.metadata,
      });

      updateItem(task.id, {
        status: "completed",
        originalBlob: result.blob,
        originalUrl: URL.createObjectURL(result.blob),
        thumbnailBlob,
        thumbnailUrl: URL.createObjectURL(thumbnailBlob),
        width: result.width,
        height: result.height,
        createdAt,
        generationTimeMs,
        metadata: result.metadata,
        parentGalleryItemIds: parentGalleryItemIds.length > 0 ? parentGalleryItemIds : undefined,
      });

      return result;
    },
    [updateItem]
  );

  const runTask = useCallback(
    async (task: GenerationTask, options: RunTaskOptions = {}) => {
      const { useRetry = true, getCanRetry = () => true } = options;
      updateItem(task.id, { status: "generating" });

      try {
        const startTime = Date.now();
        const result = useRetry ? await executeWithRetry(task) : await executeTask(task);
        return await completeTask(task, result, Date.now() - startTime);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed";
        updateItem(task.id, {
          status: "failed",
          error: message,
          canRetry: getCanRetry(error, task),
        });
        throw error;
      }
    },
    [completeTask, executeTask, executeWithRetry, updateItem]
  );

  const runTasks = useCallback(
    async (
      tasks: GenerationTask[],
      pendingItems: GalleryItem[],
      options: RunTasksOptions = {}
    ): Promise<PromiseSettledResult<GenerationResult>[]> => {
      if (tasks.length === 0) return [];

      incrementRequestedOutputCount(tasks.length);
      if (!options.itemsAlreadyAdded) {
        addItems(pendingItems);
      }
      options.onItemsCreated?.(tasks.map((task) => task.id));

      return Promise.allSettled(
        tasks.map((task) =>
          runTask(task, {
            useRetry: options.useRetry,
            getCanRetry: options.getCanRetry,
          })
        )
      );
    },
    [addItems, incrementRequestedOutputCount, runTask]
  );

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
        basePrompt: item.basePrompt,
        variationReplacements: item.variationReplacements,
        aspectRatio: item.aspectRatio,
        resolution: item.resolution,
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
