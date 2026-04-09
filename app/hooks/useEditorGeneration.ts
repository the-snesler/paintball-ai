import { useCallback } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import { getModel } from "~/lib/models";
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
            prompt: instruction,
            aspectRatio: taskAspectRatio,
            resolution: taskResolution,
            referenceImages: [{ id: referenceId, blob: referenceBlob }],
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
