import { useCallback, useMemo } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import type { CompletedGalleryItem } from "~/types";

export function useLightboxNavigation() {
  const items = useGalleryStore((s) => s.items);
  const lightboxTarget = useLightboxStore((s) => s.lightboxTarget);
  const setLightboxTarget = useLightboxStore((s) => s.setLightboxTarget);

  const completedItems = useMemo(
    () => items.filter((item): item is CompletedGalleryItem => item.status === "completed"),
    [items]
  );

  const galleryImage = useMemo(() => {
    if (!lightboxTarget || lightboxTarget.kind !== "gallery") return null;
    return completedItems.find((item) => item.id === lightboxTarget.imageId) ?? null;
  }, [completedItems, lightboxTarget]);

  const showNavigation =
    lightboxTarget?.kind === "gallery" && completedItems.length > 1;

  const navigateLightbox = useCallback(
    (direction: "prev" | "next") => {
      if (!lightboxTarget || lightboxTarget.kind !== "gallery") return;

      const currentIndex = completedItems.findIndex((item) => item.id === lightboxTarget.imageId);
      if (currentIndex === -1) return;

      const nextIndex =
        direction === "prev"
          ? currentIndex > 0
            ? currentIndex - 1
            : completedItems.length - 1
          : currentIndex < completedItems.length - 1
            ? currentIndex + 1
            : 0;

      setLightboxTarget({ kind: "gallery", imageId: completedItems[nextIndex].id });
    },
    [completedItems, lightboxTarget, setLightboxTarget]
  );

  return {
    lightboxTarget,
    galleryImage,
    referenceImage: lightboxTarget?.kind === "reference" ? lightboxTarget.image : null,
    showNavigation,
    navigateLightbox,
  };
}
