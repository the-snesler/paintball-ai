import { useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { saveReferenceImage } from "~/lib/db";
import { buildGenerationSignature } from "~/lib/generationSignature";
import { getModel } from "~/lib/models";
import { IMPROVE_PROMPT_SYSTEM } from "~/lib/prompts";
import { callTextModel, isTextModelAvailable } from "~/lib/textModel";
import type { GalleryItem } from "~/types";
import {
  parseVariationSections,
  generateVariations,
  buildVariedPrompts,
  stripVariationSections,
  collectAvoidList,
} from "~/lib/promptVariations";
import { useGenerationTask, type GenerationTask } from "~/hooks/useGenerationTask";

export function useImageGeneration() {
  const models = useSettingsStore((s) => s.models);

  const prompt = useGenerationStore((s) => s.currentPrompt);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const aspectRatio = useGenerationStore((s) => s.currentAspectRatio);
  const resolution = useGenerationStore((s) => s.currentResolution);
  const referenceImages = useGenerationStore((s) => s.currentReferenceImages);
  const startGeneration = useGenerationStore((s) => s.startGeneration);
  const finishGeneration = useGenerationStore((s) => s.finishGeneration);
  const addItems = useGalleryStore((s) => s.addItems);
  const updatePendingPromptFields = useGalleryStore((s) => s.updatePendingPromptFields);
  const { runTasks, retryItem } = useGenerationTask();

  const persistReferences = useCallback(
    async (images: Array<{ id: string; blob: Blob; name: string; sourceGalleryItemId?: string }>) => {
      await Promise.all(
        images.map(async (image) => {
          const saved = await saveReferenceImage(image);
          URL.revokeObjectURL(saved.url);
        })
      );
    },
    []
  );

  const generate = useCallback(async () => {
    const variationsEnabled = useGenerationStore.getState().variationsEnabled;
    const alwaysImprovePromptEnabled =
      useSettingsStore.getState().alwaysImprovePromptEnabled;

    const signature = buildGenerationSignature({
      prompt,
      modelSelections,
      aspectRatio,
      resolution,
      referenceImages,
    });

    // Count total tasks synchronously (everything except final prompt text is known upfront)
    let totalTasks = 0;
    for (const [modelId, count] of Object.entries(modelSelections)) {
      if (count === 0) continue;
      const model = getModel(models, modelId);
      if (model) totalTasks += count;
    }
    if (totalTasks === 0) return;

    // Build pending items + task skeletons using the user's original prompt.
    // Final prompts will be patched in once the improve/variation pipeline completes.
    const originalPrompt = prompt;
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
          prompt: originalPrompt,
          aspectRatio: taskAspectRatio,
          resolution: taskResolution,
          referenceImageIds: referenceImages.map((r) => r.id),
          retryCount: 0,
        });
      }
    }

    if (taskSlots.length === 0) return;

    // Show loading cards immediately and register the generation. The prompt-prep
    // pipeline runs concurrently — by the time pending items become `generating`,
    // their prompts have already been patched with the final text.
    addItems(pendingItems);
    startGeneration(signature);

    try {
      await persistReferences(
        referenceImages.map((image) => ({
          id: image.id,
          blob: image.blob,
          name: image.name,
          sourceGalleryItemId: image.sourceGalleryItemId,
        }))
      );

      const imageBlobs = referenceImages.map((r) => r.blob);

      // Step 1: optionally improve the prompt (variation brackets are preserved).
      let workingPrompt = originalPrompt;
      let improved = false;
      if (alwaysImprovePromptEnabled && isTextModelAvailable()) {
        try {
          const result = await callTextModel(
            IMPROVE_PROMPT_SYSTEM,
            originalPrompt,
            imageBlobs.length > 0 ? imageBlobs : undefined
          );
          const trimmed = result.trim();
          if (trimmed) {
            workingPrompt = trimmed;
            improved = trimmed !== originalPrompt;
          }
        } catch {
          // Fall back to the original prompt
        }
      }

      // Step 2: optionally generate prompt variations
      let variedPrompts: string[] | null = null;
      let variationReplacements: string[][] | null = null;
      if (variationsEnabled) {
        const sections = parseVariationSections(workingPrompt);
        if (sections.length > 0) {
          try {
            const { avoidPastVariations } = useGenerationStore.getState();
            const { items } = useGalleryStore.getState();
            const avoidPerSection = avoidPastVariations
              ? (collectAvoidList(workingPrompt, items) ?? undefined)
              : undefined;
            const replacements = await generateVariations(
              workingPrompt,
              sections,
              totalTasks,
              imageBlobs.length > 0 ? imageBlobs : undefined,
              avoidPerSection
            );
            variedPrompts = buildVariedPrompts(workingPrompt, sections, replacements);
            variationReplacements = replacements;
          } catch {
            variedPrompts = null;
            variationReplacements = null;
          }
        }
      }

      // Step 3: compute final per-task prompt + basePrompt + replacements.
      // basePrompt is the user's original prompt whenever any transformation
      // (improve and/or variations) was applied.
      const fallbackPrompt =
        variationsEnabled && !variedPrompts
          ? stripVariationSections(workingPrompt)
          : workingPrompt;

      const anyTransformApplied = improved || Boolean(variedPrompts);
      const groupPrompt = anyTransformApplied ? originalPrompt : undefined;

      const tasks: GenerationTask[] = taskSlots.map((slot, taskIndex) => {
        const taskPrompt = variedPrompts ? variedPrompts[taskIndex] : fallbackPrompt;
        const taskReplacements = variationReplacements
          ? variationReplacements.map((col) => col[taskIndex])
          : undefined;

        return {
          id: slot.id,
          modelId: slot.modelId,
          modelName: slot.modelName,
          provider: slot.provider,
          prompt: taskPrompt,
          basePrompt: groupPrompt,
          variationReplacements: taskReplacements,
          aspectRatio: slot.aspectRatio,
          resolution: slot.resolution,
          referenceImages: referenceImages.map((r) => ({
            id: r.id,
            blob: r.blob,
            sourceGalleryItemId: r.sourceGalleryItemId,
          })),
        };
      });

      // Patch the already-visible pending items with their final prompt data so
      // the gallery records match what gets sent to the model.
      updatePendingPromptFields(
        tasks.map((t) => ({
          id: t.id,
          prompt: t.prompt,
          basePrompt: t.basePrompt,
          variationReplacements: t.variationReplacements,
        }))
      );

      return await runTasks(tasks, pendingItems, { itemsAlreadyAdded: true });
    } finally {
      finishGeneration(signature);
    }
  }, [
    prompt,
    modelSelections,
    aspectRatio,
    resolution,
    referenceImages,
    models,
    startGeneration,
    finishGeneration,
    persistReferences,
    runTasks,
    addItems,
    updatePendingPromptFields,
  ]);

  return { generate, retryItem };
}
