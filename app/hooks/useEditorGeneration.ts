import { useCallback } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import { useGalleryStore } from "~/stores/galleryStore";
import { getModel } from "~/lib/models";
import { saveReferenceImage } from "~/lib/db";
import { preparePromptBatch } from "~/lib/promptPreparation";
import type { AspectRatio, GalleryItem, Resolution } from "~/types";
import { useGenerationTask, type GenerationTask } from "~/hooks/useGenerationTask";

export function useEditorGeneration() {
  const models = useSettingsStore((s) => s.models);
  const alwaysImprovePromptEnabled = useSettingsStore((s) => s.alwaysImprovePromptEnabled);
  const addItems = useGalleryStore((s) => s.addItems);
  const updatePendingPromptFields = useGalleryStore((s) => s.updatePendingPromptFields);
  const updatePendingPhase = useGalleryStore((s) => s.updatePendingPhase);
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
      /** Original user-typed instruction before any improvement. When set, stored as
       *  basePrompt on resulting gallery items so the lightbox can show it. */
      basePrompt?: string;
      referenceBlob: Blob;
      referenceId: string;
      /** Gallery item ID that the source blob was derived from, if any */
      sourceGalleryItemId?: string;
      additionalReferences?: Array<{
        id: string;
        blob: Blob;
        name: string;
        sourceGalleryItemId?: string;
      }>;
      modelSelections: Record<string, number>;
      aspectRatio: AspectRatio | null;
      resolution: Resolution;
      onItemsCreated: (itemIds: string[]) => void;
      onPromptPrepared?: (prompt: string) => void;
    }): Promise<void> => {
      const {
        instruction,
        basePrompt,
        referenceBlob,
        referenceId,
        sourceGalleryItemId,
        additionalReferences,
        modelSelections,
        aspectRatio,
        resolution,
        onItemsCreated,
        onPromptPrepared,
      } = params;

      // Source image first, then additional references
      const allReferences: Array<{ id: string; blob: Blob; sourceGalleryItemId?: string }> = [
        { id: referenceId, blob: referenceBlob, sourceGalleryItemId },
        ...(additionalReferences ?? []).map((r) => ({
          id: r.id,
          blob: r.blob,
          sourceGalleryItemId: r.sourceGalleryItemId,
        })),
      ];
      const allReferenceIds = allReferences.map((r) => r.id);

      const taskSlots: Array<{
        id: string;
        modelId: string;
        modelName: string;
        provider: GenerationTask["provider"];
        aspectRatio: GenerationTask["aspectRatio"];
        resolution: GenerationTask["resolution"];
      }> = [];
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

          taskSlots.push({
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
            basePrompt,
            aspectRatio: taskAspectRatio,
            resolution: taskResolution,
            referenceImageIds: allReferenceIds,
            retryCount: 0,
          });
        }
      }

      if (taskSlots.length === 0) return;
      const taskIds = taskSlots.map((slot) => slot.id);

      addItems(pendingItems);
      onItemsCreated(taskIds);

      // Persist additional references to IndexedDB for retry support
      if (additionalReferences && additionalReferences.length > 0) {
        await Promise.all(
          additionalReferences.map(async (ref) => {
            const saved = await saveReferenceImage(ref);
            URL.revokeObjectURL(saved.url);
          })
        );
      }

      const preparedPrompts = await preparePromptBatch({
        prompt: instruction,
        totalTasks: taskSlots.length,
        images: allReferences.map((r) => r.blob),
        improvePrompt: alwaysImprovePromptEnabled,
        onStageChange: (stage) => {
          updatePendingPhase(taskIds, stage);
        },
      });

      const sentPrompt = preparedPrompts.prompts[0] ?? instruction;
      if (onPromptPrepared) {
        onPromptPrepared(sentPrompt);
      }

      const displayBasePrompt = basePrompt && sentPrompt !== basePrompt ? basePrompt : undefined;

      const tasks: GenerationTask[] = taskSlots.map((slot, taskIndex) => ({
        id: slot.id,
        modelId: slot.modelId,
        modelName: slot.modelName,
        provider: slot.provider,
        prompt: preparedPrompts.prompts[taskIndex] ?? instruction,
        basePrompt: displayBasePrompt,
        aspectRatio: slot.aspectRatio,
        resolution: slot.resolution,
        referenceImages: allReferences,
      }));

      updatePendingPromptFields(
        tasks.map((task) => ({
          id: task.id,
          prompt: task.prompt,
          basePrompt: task.basePrompt,
        }))
      );
      updatePendingPhase(taskIds, undefined);

      await runTasks(tasks, {
        getCanRetry: (error) =>
          !(error instanceof Error && error.message.startsWith("No API key for ")),
      });
    },
    [
      addItems,
      alwaysImprovePromptEnabled,
      models,
      runTasks,
      updatePendingPhase,
      updatePendingPromptFields,
    ]
  );

  return { generateEdit };
}
