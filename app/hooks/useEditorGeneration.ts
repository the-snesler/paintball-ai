import { useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { saveImage } from "~/lib/db";
import { getModel } from "~/lib/models";
import { createThumbnailBlob } from "~/lib/imageProcessing";
import { executeGeneration } from "~/lib/generation";
import type { AspectRatio, GalleryItem, Resolution } from "~/types";

export function useEditorGeneration() {
  const models = useSettingsStore((s) => s.models);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const addItems = useGalleryStore((s) => s.addItems);
  const updateItem = useGalleryStore((s) => s.updateItem);
  const incrementRequestedOutputCount = useSettingsStore(
    (s) => s.incrementRequestedOutputCount
  );

  /**
   * Prepare and execute an edit turn.
   *
   * Synchronously creates pending gallery items and calls `onItemsCreated`
   * with their IDs before any async work begins, so the caller can immediately
   * register the turn in the editor store.
   */
  const generateEdit = useCallback(
    async (params: {
      instruction: string;
      referenceBlob: Blob;
      referenceId: string;
      modelSelections: Record<string, number>;
      aspectRatio: AspectRatio | null;
      resolution: Resolution;
      onItemsCreated: (itemIds: string[]) => void;
    }): Promise<void> => {
      const {
        instruction,
        referenceBlob,
        referenceId,
        modelSelections,
        aspectRatio,
        resolution,
        onItemsCreated,
      } = params;

      interface Task {
        id: string;
        modelId: string;
        modelName: string;
        provider: "google" | "replicate";
        aspectRatio: AspectRatio | null;
        resolution: Resolution | null;
      }

      const tasks: Task[] = [];
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
            aspectRatio: taskAspectRatio,
            resolution: taskResolution,
          });

          pendingItems.push({
            id: taskId,
            status: "pending",
            modelId,
            modelName: model.name,
            prompt: instruction,
            aspectRatio: taskAspectRatio,
            resolution: taskResolution,
            referenceImageIds: [referenceId],
            retryCount: 0,
          });
        }
      }

      if (tasks.length === 0) return;

      incrementRequestedOutputCount(tasks.length);
      addItems(pendingItems);

      // Notify caller synchronously before first await
      onItemsCreated(tasks.map((t) => t.id));

      await Promise.allSettled(
        tasks.map(async (task) => {
          updateItem(task.id, { status: "generating" });

          const apiKey = apiKeys[task.provider];
          if (!apiKey) {
            updateItem(task.id, {
              status: "failed",
              error: `No API key for ${task.provider}`,
              canRetry: false,
            });
            return;
          }

          try {
            const result = await executeGeneration(
              {
                modelId: task.modelId,
                provider: task.provider,
                prompt: instruction,
                aspectRatio: task.aspectRatio,
                resolution: task.resolution,
                referenceImages: [{ id: referenceId, blob: referenceBlob }],
              },
              apiKey
            );

            const thumbnailBlob = await createThumbnailBlob(result.blob, 400);
            const createdAt = Date.now();

            await saveImage({
              originalBlob: result.blob,
              thumbnailBlob,
              prompt: instruction,
              modelId: task.modelId,
              modelName: task.modelName,
              aspectRatio: task.aspectRatio,
              resolution: task.resolution,
              width: result.width,
              height: result.height,
              createdAt,
              referenceImageIds: [referenceId],
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
              metadata: result.metadata,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Generation failed";
            updateItem(task.id, { status: "failed", error: message, canRetry: true });
          }
        })
      );
    },
    [models, apiKeys, addItems, updateItem, incrementRequestedOutputCount]
  );

  return { generateEdit };
}
