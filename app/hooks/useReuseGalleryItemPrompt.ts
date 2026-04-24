import { useCallback } from "react";
import { getReferenceImagesByIds } from "~/lib/db";
import { hasVariationSections } from "~/lib/promptVariations";
import { useGenerationStore } from "~/stores/generationStore";
import type { CompletedGalleryItem } from "~/types";

export function useReuseGalleryItemPrompt() {
  const clearReferenceImages = useGenerationStore((s) => s.clearReferenceImages);
  const addReferenceImages = useGenerationStore((s) => s.addReferenceImages);
  const setPrompt = useGenerationStore((s) => s.setPrompt);
  const setVariationsEnabled = useGenerationStore((s) => s.setVariationsEnabled);

  return useCallback(
    async (item: CompletedGalleryItem) => {
      clearReferenceImages();
      const references = await getReferenceImagesByIds(item.referenceImageIds);
      addReferenceImages(references);
      setPrompt(item.basePrompt ?? item.prompt);
      setVariationsEnabled(false);
    },
    [addReferenceImages, clearReferenceImages, setPrompt, setVariationsEnabled]
  );
}

export function useReuseGalleryItemBasePrompt() {
  const clearReferenceImages = useGenerationStore((s) => s.clearReferenceImages);
  const addReferenceImages = useGenerationStore((s) => s.addReferenceImages);
  const setPrompt = useGenerationStore((s) => s.setPrompt);
  const setVariationsEnabled = useGenerationStore((s) => s.setVariationsEnabled);

  return useCallback(
    async (item: CompletedGalleryItem) => {
      if (!item.basePrompt) return;
      clearReferenceImages();
      const references = await getReferenceImagesByIds(item.referenceImageIds);
      addReferenceImages(references);
      setPrompt(item.basePrompt);
      setVariationsEnabled(hasVariationSections(item.basePrompt));
    },
    [addReferenceImages, clearReferenceImages, setPrompt, setVariationsEnabled]
  );
}
