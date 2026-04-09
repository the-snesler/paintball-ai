import { useCallback } from "react";
import { getReferenceImagesByIds } from "~/lib/db";
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
      setVariationsEnabled(Boolean(item.basePrompt));
    },
    [addReferenceImages, clearReferenceImages, setPrompt, setVariationsEnabled]
  );
}
