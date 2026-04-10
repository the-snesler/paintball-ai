import { useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { saveReferenceImage } from "~/lib/db";
import { buildGenerationSignature } from "~/lib/generationSignature";
import { getModel } from "~/lib/models";
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
  const { runTasks, retryItem } = useGenerationTask();

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

  const generate = useCallback(async () => {
    const variationsEnabled = useGenerationStore.getState().variationsEnabled;

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
          useGenerationStore.getState().setIsPreparingVariations(true);
          const imageBlobs = referenceImages.map((r) => r.blob);
          const { avoidPastVariations } = useGenerationStore.getState();
          const { items } = useGalleryStore.getState();
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
          useGenerationStore.getState().setIsPreparingVariations(false);
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
        const supportedRatios = model.capabilities.supportedAspectRatios;
        const taskAspectRatio =
          aspectRatio && supportedRatios
            ? supportedRatios.includes(aspectRatio)
              ? aspectRatio
              : null
            : model.capabilities.supportsAspectRatios
              ? aspectRatio
              : null;
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

    await persistReferences(
      referenceImages.map((image) => ({
        id: image.id,
        blob: image.blob,
        name: image.name,
      }))
    );

    // Add pending items to gallery immediately
    startGeneration(signature);

    try {
      return await runTasks(tasks, pendingItems);
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
  ]);

  return { generate, retryItem };
}
