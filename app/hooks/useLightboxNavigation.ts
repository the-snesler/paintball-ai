import { useCallback, useMemo } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import { useGalleryDerivedIndexes } from "./useGalleryDerivedIndexes";

export function useLightboxNavigation() {
  const { completedItems, completedItemsByPrompt, getItemById } = useGalleryDerivedIndexes();
  const viewMode = useGalleryStore((s) => s.viewMode);
  const lightboxTarget = useLightboxStore((s) => s.lightboxTarget);
  const setLightboxTarget = useLightboxStore((s) => s.setLightboxTarget);

  // In timeline mode, navigate in group order (same grouping as TimelineView).
  // In grid mode, use the raw store order.
  const orderedItems = useMemo(() => {
    if (viewMode !== "timeline") return completedItems;
    return Array.from(completedItemsByPrompt.values()).flat();
  }, [completedItems, completedItemsByPrompt, viewMode]);

  const galleryImage = useMemo(() => {
    if (!lightboxTarget || lightboxTarget.kind !== "gallery") return null;
    const item = getItemById(lightboxTarget.imageId);
    return item?.status === "completed" ? item : null;
  }, [getItemById, lightboxTarget]);

  const showNavigation =
    lightboxTarget?.kind === "gallery" && orderedItems.length > 1;

  const navigateLightbox = useCallback(
    (direction: "prev" | "next") => {
      if (!lightboxTarget || lightboxTarget.kind !== "gallery") return;

      const currentIndex = orderedItems.findIndex((item) => item.id === lightboxTarget.imageId);
      if (currentIndex === -1) return;

      const nextIndex =
        direction === "prev"
          ? currentIndex > 0
            ? currentIndex - 1
            : orderedItems.length - 1
          : currentIndex < orderedItems.length - 1
            ? currentIndex + 1
            : 0;

      setLightboxTarget({ kind: "gallery", imageId: orderedItems[nextIndex].id });
    },
    [orderedItems, lightboxTarget, setLightboxTarget]
  );

  return {
    lightboxTarget,
    galleryImage,
    referenceImage: lightboxTarget?.kind === "reference" ? lightboxTarget.image : null,
    showNavigation,
    navigateLightbox,
  };
}
