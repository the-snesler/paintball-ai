import { useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { getReferenceImagesByIds, saveReferenceImage } from "~/lib/db";
import { buildGenerationSignature } from "~/lib/generationSignature";
import { getModel, getStrictReferenceImageLimit } from "~/lib/models";
import { preparePromptBatch } from "~/lib/promptPreparation";
import { applyPromptAdditions } from "~/lib/styleApplication";
import { computeReferencePrecedence } from "~/lib/referencePrecedence";
import type { GalleryItem } from "~/types";
import { useGenerationTask, type GenerationTask } from "~/hooks/useGenerationTask";

export function useImageGeneration() {
  const models = useSettingsStore((s) => s.models);

  const prompt = useGenerationStore((s) => s.currentPrompt);
  const basePrompt = useGenerationStore((s) => s.currentBasePrompt);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const aspectRatio = useGenerationStore((s) => s.currentAspectRatio);
  const resolution = useGenerationStore((s) => s.currentResolution);
  const quality = useGenerationStore((s) => s.currentQuality);
  const numberOfImages = useGenerationStore((s) => s.currentNumberOfImages);
  const referenceImages = useGenerationStore((s) => s.currentReferenceImages);
  const startGeneration = useGenerationStore((s) => s.startGeneration);
  const finishGeneration = useGenerationStore((s) => s.finishGeneration);
  const addItems = useGalleryStore((s) => s.addItems);
  const updatePendingPromptFields = useGalleryStore((s) => s.updatePendingPromptFields);
  const updatePendingPhase = useGalleryStore((s) => s.updatePendingPhase);
  const { runTasks, retryItem } = useGenerationTask();

  const persistReferences = useCallback(
    async (
      images: Array<{ id: string; blob: Blob; name: string; sourceGalleryItemId?: string }>
    ) => {
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
    const { currentStyleId, currentCharacterId } = useGenerationStore.getState();
    const settings = useSettingsStore.getState();
    const alwaysImprovePromptEnabled = settings.alwaysImprovePromptEnabled;
    const selectedStyle = currentStyleId
      ? (settings.styles.find((s) => s.id === currentStyleId && s.enabled) ?? null)
      : null;
    const selectedCharacter = currentCharacterId
      ? (settings.characters.find((c) => c.id === currentCharacterId && c.enabled) ?? null)
      : null;

    const signature = buildGenerationSignature({
      prompt,
      modelSelections,
      aspectRatio,
      resolution,
      quality,
      numberOfImages,
      referenceImages,
      styleId: currentStyleId,
      characterId: currentCharacterId,
    });

    // Count total API calls synchronously.
    let totalTasks = 0;
    for (const [modelId, count] of Object.entries(modelSelections)) {
      if (count === 0) continue;
      const model = getModel(models, modelId);
      if (model) totalTasks += count;
    }
    if (totalTasks === 0) return;

    const originalPrompt = prompt;
    const taskSlots: Array<{
      itemIds: string[];
      modelId: string;
      modelName: string;
      provider: GenerationTask["provider"];
      aspectRatio: GenerationTask["aspectRatio"];
      resolution: GenerationTask["resolution"];
      quality: string | null;
      numberOfImages: number;
    }> = [];
    const pendingItems: GalleryItem[] = [];

    for (const [modelId, count] of Object.entries(modelSelections)) {
      if (count === 0) continue;
      const model = getModel(models, modelId);
      if (!model) continue;

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
      const taskQuality = model.capabilities.supportsQuality ? quality : null;
      const maxBatch = model.capabilities.maxImagesPerRequest ?? 1;
      const perCallImages = model.capabilities.supportsNumberOfImages
        ? Math.max(1, Math.min(numberOfImages, maxBatch))
        : 1;

      for (let i = 0; i < count; i++) {
        const itemIds = Array.from({ length: perCallImages }, () => crypto.randomUUID());

        taskSlots.push({
          itemIds,
          modelId,
          modelName: model.name,
          provider: model.provider,
          aspectRatio: taskAspectRatio,
          resolution: taskResolution,
          quality: taskQuality,
          numberOfImages: perCallImages,
        });

        for (const itemId of itemIds) {
          pendingItems.push({
            id: itemId,
            status: "pending",
            modelId,
            modelName: model.name,
            prompt: originalPrompt,
            aspectRatio: taskAspectRatio,
            resolution: taskResolution,
            quality: taskQuality,
            referenceImageIds: referenceImages.map((r) => r.id),
            retryCount: 0,
          });
        }
      }
    }

    if (taskSlots.length === 0) return;
    const taskIds = taskSlots.flatMap((slot) => slot.itemIds);

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

      // Load style reference blob
      let styleRefBlob: Blob | null = null;
      let styleRefId: string | null = null;
      if (selectedStyle?.referenceImageId) {
        const [loaded] = await getReferenceImagesByIds([selectedStyle.referenceImageId]);
        if (loaded) {
          styleRefBlob = loaded.blob;
          styleRefId = loaded.id;
          URL.revokeObjectURL(loaded.url);
        }
      }

      // Load character reference blobs
      let characterRefBlobs: Array<{ id: string; blob: Blob }> = [];
      if (selectedCharacter?.referenceImageIds.length) {
        const loaded = await getReferenceImagesByIds(selectedCharacter.referenceImageIds);
        characterRefBlobs = loaded.map((r) => {
          URL.revokeObjectURL(r.url);
          return { id: r.id, blob: r.blob };
        });
      }

      // Effective style (no ref image if blob failed to load)
      const effectiveStyle = styleRefBlob
        ? selectedStyle
        : selectedStyle
          ? { ...selectedStyle, referenceImageId: undefined }
          : null;

      // Compute prompt with character + style appended
      const additions = applyPromptAdditions(
        originalPrompt,
        selectedCharacter,
        effectiveStyle,
        referenceImages.length
      );

      // Apply reference precedence across all selected models
      const selectedModelIds = Object.entries(modelSelections)
        .filter(([, c]) => c > 0)
        .map(([id]) => id);
      const strictLimit = getStrictReferenceImageLimit(models, selectedModelIds);
      const precedence = computeReferencePrecedence({
        manualCount: referenceImages.length,
        styleHasRef: styleRefBlob !== null,
        characterRefCount: characterRefBlobs.length,
        limit: strictLimit,
      });

      // Build final ordered reference list respecting precedence
      const finalManual = referenceImages.slice(0, precedence.keepManual);
      const finalStyleRef: Array<{ id: string; blob: Blob }> =
        precedence.keepStyle && styleRefBlob && styleRefId
          ? [{ id: styleRefId, blob: styleRefBlob }]
          : [];
      const finalCharacterRefs = characterRefBlobs.slice(0, precedence.keepCharacter);
      const finalImageBlobs = [
        ...finalManual.map((r) => r.blob),
        ...finalStyleRef.map((r) => r.blob),
        ...finalCharacterRefs.map((r) => r.blob),
      ];

      const { avoidPastVariations } = useGenerationStore.getState();
      const { items } = useGalleryStore.getState();
      const preparedPrompts = await preparePromptBatch({
        prompt: additions.prompt,
        totalTasks,
        images: finalImageBlobs.length > 0 ? finalImageBlobs : undefined,
        improvePrompt: alwaysImprovePromptEnabled && basePrompt === null,
        variationsEnabled,
        avoidPastVariations,
        galleryItemsForAvoid: items,
        onStageChange: (stage) => {
          updatePendingPhase(taskIds, stage);
        },
      });

      const anyTransformApplied =
        selectedStyle || selectedCharacter || preparedPrompts.improved || preparedPrompts.usedVariations;
      const groupPrompt = basePrompt ?? (anyTransformApplied ? originalPrompt : undefined);

      const allRefEntries = [
        ...finalManual.map((r) => ({
          id: r.id,
          blob: r.blob,
          sourceGalleryItemId: r.sourceGalleryItemId,
        })),
        ...finalStyleRef,
        ...finalCharacterRefs,
      ];

      const tasks: GenerationTask[] = taskSlots.map((slot, taskIndex) => {
        const taskPrompt = preparedPrompts.prompts[taskIndex] ?? additions.prompt;
        const taskReplacements = preparedPrompts.variationReplacementsByTask?.[taskIndex];

        return {
          itemIds: slot.itemIds,
          modelId: slot.modelId,
          modelName: slot.modelName,
          provider: slot.provider,
          prompt: taskPrompt,
          basePrompt: groupPrompt,
          variationReplacements: taskReplacements,
          aspectRatio: slot.aspectRatio,
          resolution: slot.resolution,
          quality: slot.quality,
          numberOfImages: slot.numberOfImages,
          referenceImages: allRefEntries,
        };
      });

      updatePendingPromptFields(
        tasks.flatMap((t) =>
          t.itemIds.map((id) => ({
            id,
            prompt: t.prompt,
            basePrompt: t.basePrompt,
            variationReplacements: t.variationReplacements,
          }))
        )
      );
      updatePendingPhase(taskIds, undefined);

      return await runTasks(tasks);
    } finally {
      finishGeneration(signature);
    }
  }, [
    prompt,
    basePrompt,
    modelSelections,
    aspectRatio,
    resolution,
    quality,
    numberOfImages,
    referenceImages,
    models,
    startGeneration,
    finishGeneration,
    persistReferences,
    runTasks,
    addItems,
    updatePendingPromptFields,
    updatePendingPhase,
  ]);

  return { generate, retryItem };
}
