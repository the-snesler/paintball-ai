import { useCallback, useMemo } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import { groupItemsByPrompt } from "~/lib/galleryGrouping";
import type { CompletedGalleryItem } from "~/types";

export function useLightboxNavigation() {
  const items = useGalleryStore((s) => s.items);
  const viewMode = useGalleryStore((s) => s.viewMode);
  const lightboxTarget = useLightboxStore((s) => s.lightboxTarget);
  const setLightboxTarget = useLightboxStore((s) => s.setLightboxTarget);

  const completedItems = useMemo(
    () => items.filter((item): item is CompletedGalleryItem => item.status === "completed"),
    [items]
  );

  // In timeline mode, navigate in group order (same grouping as TimelineView).
  // In grid mode, use the raw store order.
  const orderedItems = useMemo(() => {
    if (viewMode !== "timeline") return completedItems;
    const grouped = groupItemsByPrompt(completedItems);
    return Array.from(grouped.values()).flat() as CompletedGalleryItem[];
  }, [completedItems, viewMode]);

  const galleryImage = useMemo(() => {
    if (!lightboxTarget || lightboxTarget.kind !== "gallery") return null;
    return orderedItems.find((item) => item.id === lightboxTarget.imageId) ?? null;
  }, [orderedItems, lightboxTarget]);

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
