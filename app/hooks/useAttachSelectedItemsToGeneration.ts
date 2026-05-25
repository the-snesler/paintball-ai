import { useCallback } from "react";
import { canAttachReferenceCount } from "~/lib/models";
import { useGalleryStore } from "~/stores/galleryStore";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import type { AttachSelectedItemsResult, CompletedGalleryItem, ReferenceImage } from "~/types";

export function useAttachSelectedItemsToGeneration() {
  const models = useSettingsStore((s) => s.models);
  const clearSelection = useGalleryStore((s) => s.clearSelection);

  return useCallback((): AttachSelectedItemsResult => {
    const galleryState = useGalleryStore.getState();
    const generationState = useGenerationStore.getState();
    const selectedSet = new Set(galleryState.selectedItemIds);
    const selectedItems = galleryState.items.filter(
      (item): item is CompletedGalleryItem =>
        item.status === "completed" && selectedSet.has(item.id)
    );

    // Exclude video items — reference images must be still frames.
    const imageOnlyItems = selectedItems.filter(
      (item) => !item.originalBlob.type.startsWith("video/")
    );

    if (imageOnlyItems.length === 0) {
      return {
        success: false,
        attachedCount: 0,
        maxAllowed: null,
        reason:
          selectedItems.length > 0
            ? "Videos cannot be used as reference images."
            : "No images selected.",
      };
    }

    const selectedModelIds = Object.entries(generationState.currentModelSelections)
      .filter(([, count]) => count > 0)
      .map(([modelId]) => modelId);

    const totalReferences = generationState.currentReferenceImages.length + imageOnlyItems.length;
    const fit = canAttachReferenceCount(models, selectedModelIds, totalReferences);

    if (!fit.allowed) {
      return {
        success: false,
        attachedCount: 0,
        maxAllowed: fit.maxAllowed,
        reason:
          fit.maxAllowed === null
            ? "One or more selected models do not support reference images."
            : `Selected images exceed the current model limit (${fit.maxAllowed} max).`,
      };
    }

    const newReferences: ReferenceImage[] = imageOnlyItems.map((item) => ({
      id: crypto.randomUUID(),
      blob: item.originalBlob,
      url: URL.createObjectURL(item.originalBlob),
      name: `${item.modelName} - ${item.prompt.slice(0, 40).trim() || "Image"}`,
    }));

    useGenerationStore.getState().addReferenceImages(newReferences);
    clearSelection();

    return {
      success: true,
      attachedCount: newReferences.length,
      maxAllowed: fit.maxAllowed,
    };
  }, [clearSelection, models]);
}
