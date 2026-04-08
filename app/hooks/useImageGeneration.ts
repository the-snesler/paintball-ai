import { useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { getReferenceImagesByIds, saveImage, saveReferenceImage } from "~/lib/db";
import { buildGenerationSignature } from "~/lib/generationSignature";
import { getModel } from "~/lib/models";
import { createThumbnailBlob } from "~/lib/imageProcessing";
import type { ApiKeys, AspectRatio, GalleryItem, Provider, Resolution } from "~/types";
import { executeGeneration } from "~/lib/generation";
import { retryWithBackoff } from "~/lib/retry";
import {
  parseVariationSections,
  generateVariations,
  buildVariedPrompts,
  stripVariationSections,
  collectAvoidList,
} from "~/lib/promptVariations";

interface GenerationTask {
  id: string;
  modelId: string;
  modelName: string;
  provider: Provider;
  prompt: string;
  basePrompt?: string;
  variationReplacements?: string[];
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
    (task: GenerationTask, apiKeys: ApiKeys) =>
      retryWithBackoff(() => executeGenerationTask(task, apiKeys), {
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
      updateItem(itemId, { status: "generating" });

      try {
        const result = await executeWithRetry(task, apiKeys);
        const thumbnailBlob = await createThumbnailBlob(result.blob, 400);
        const createdAt = Date.now();

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
    const variationsEnabled = useGalleryStore.getState().variationsEnabled;

    const signature = buildGenerationSignature({
      prompt,
      modelSelections,
      aspectRatio,
      resolution,
      referenceImages,
    });

    // Count total tasks to know how many variations we need
    let totalTasks = 0;
    for (const [modelId, count] of Object.entries(modelSelections)) {
      if (count === 0) continue;
      const model = getModel(models, modelId);
      if (model) totalTasks += count;
    }
    if (totalTasks === 0) return;

    // Generate prompt variations if enabled
    let variedPrompts: string[] | null = null;
    let variationReplacements: string[][] | null = null;
    if (variationsEnabled) {
      const sections = parseVariationSections(prompt);
      if (sections.length > 0) {
        try {
          useGalleryStore.setState({ isPreparingVariations: true });
          const imageBlobs = referenceImages.map((r) => r.blob);
          const { avoidPastVariations, items } = useGalleryStore.getState();
          const avoidPerSection = avoidPastVariations
            ? (collectAvoidList(prompt, items) ?? undefined)
            : undefined;
          const replacements = await generateVariations(
            prompt,
            sections,
            totalTasks,
            imageBlobs.length > 0 ? imageBlobs : undefined,
            avoidPerSection
          );
          variedPrompts = buildVariedPrompts(prompt, sections, replacements);
          variationReplacements = replacements;
        } catch {
          // Fall back to stripping variation brackets and using the example text
          variedPrompts = null;
          variationReplacements = null;
        } finally {
          useGalleryStore.setState({ isPreparingVariations: false });
        }
      }
    }

    // If variations were requested but failed/no sections, strip brackets from prompt
    const basePromptText =
      variationsEnabled && !variedPrompts ? stripVariationSections(prompt) : prompt;

    // When variations were applied, all sibling tasks share this group key (the original template).
    const groupPrompt = variedPrompts ? prompt : undefined;

    // Build tasks for each model/count
    const tasks: GenerationTask[] = [];
    const pendingItems: GalleryItem[] = [];
    let taskIndex = 0;

    for (const [modelId, count] of Object.entries(modelSelections)) {
      if (count === 0) continue;

      const model = getModel(models, modelId);
      if (!model) continue;

      for (let i = 0; i < count; i++) {
        const taskId = crypto.randomUUID();
        const taskResolution = model.capabilities.supportsResolution ? resolution : null;
        const taskAspectRatio = model.capabilities.supportsAspectRatios ? aspectRatio : null;
        const taskPrompt = variedPrompts ? variedPrompts[taskIndex] : basePromptText;
        const taskReplacements = variationReplacements
          ? variationReplacements.map((col) => col[taskIndex])
          : undefined;

        tasks.push({
          id: taskId,
          modelId,
          modelName: model.name,
          provider: model.provider,
          prompt: taskPrompt,
          basePrompt: groupPrompt,
          variationReplacements: taskReplacements,
          aspectRatio: taskAspectRatio,
          resolution: taskResolution,
          referenceImages: referenceImages.map((r) => ({ id: r.id, blob: r.blob })),
        });

        pendingItems.push({
          id: taskId,
          status: "pending",
          modelId,
          modelName: model.name,
          prompt: taskPrompt,
          basePrompt: groupPrompt,
          variationReplacements: taskReplacements,
          aspectRatio: taskAspectRatio,
          resolution: taskResolution,
          referenceImageIds: referenceImages.map((r) => r.id),
          retryCount: 0,
        });

        taskIndex++;
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
            const result = await executeWithRetry(task, apiKeys);
            const thumbnailBlob = await createThumbnailBlob(result.blob, 400);
            const createdAt = Date.now();

            // Save to IndexedDB
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
