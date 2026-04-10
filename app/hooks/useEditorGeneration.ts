import { useCallback } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import { getModel } from "~/lib/models";
import { saveReferenceImage } from "~/lib/db";
import type { AspectRatio, GalleryItem, Resolution } from "~/types";
import { useGenerationTask, type GenerationTask } from "~/hooks/useGenerationTask";

export function useEditorGeneration() {
  const models = useSettingsStore((s) => s.models);
  const { runTasks } = useGenerationTask();

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
      additionalReferences?: Array<{ id: string; blob: Blob; name: string }>;
      modelSelections: Record<string, number>;
      aspectRatio: AspectRatio | null;
      resolution: Resolution;
      onItemsCreated: (itemIds: string[]) => void;
    }): Promise<void> => {
      const {
        instruction,
        referenceBlob,
        referenceId,
        additionalReferences,
        modelSelections,
        aspectRatio,
        resolution,
        onItemsCreated,
      } = params;

      // Persist additional references to IndexedDB for retry support
      if (additionalReferences && additionalReferences.length > 0) {
        await Promise.all(
          additionalReferences.map(async (ref) => {
            const saved = await saveReferenceImage(ref);
            URL.revokeObjectURL(saved.url);
          })
        );
      }

      // Source image first, then additional references
      const allReferences: Array<{ id: string; blob: Blob }> = [
        { id: referenceId, blob: referenceBlob },
        ...(additionalReferences ?? []).map((r) => ({ id: r.id, blob: r.blob })),
      ];
      const allReferenceIds = allReferences.map((r) => r.id);

      const tasks: GenerationTask[] = [];
      const pendingItems: GalleryItem[] = [];

      for (const [modelId, count] of Object.entries(modelSelections)) {
        if (count === 0) continue;
        const model = getModel(models, modelId);
        if (!model) continue;

        for (let i = 0; i < count; i++) {
          const taskId = crypto.randomUUID();
          const taskResolution = model.capabilities.supportsResolution ? resolution : null;
          const supportedRatios = model.capabilities.supportedAspectRatios;
          const taskAspectRatio =
            aspectRatio && supportedRatios
              ? supportedRatios.includes(aspectRatio)
                ? aspectRatio
                : null
              : model.capabilities.supportsAspectRatios
                ? aspectRatio
                : null;

          tasks.push({
            id: taskId,
            modelId,
            modelName: model.name,
            provider: model.provider,
            prompt: instruction,
            aspectRatio: taskAspectRatio,
            resolution: taskResolution,
            referenceImages: allReferences,
          });

          pendingItems.push({
            id: taskId,
            status: "pending",
            modelId,
            modelName: model.name,
            prompt: instruction,
            aspectRatio: taskAspectRatio,
            resolution: taskResolution,
            referenceImageIds: allReferenceIds,
            retryCount: 0,
          });
        }
      }

      if (tasks.length === 0) return;

      await runTasks(tasks, pendingItems, {
        onItemsCreated,
        getCanRetry: (error) =>
          !(error instanceof Error && error.message.startsWith("No API key for ")),
      });
    },
    [models, runTasks]
  );

  return { generateEdit };
}
