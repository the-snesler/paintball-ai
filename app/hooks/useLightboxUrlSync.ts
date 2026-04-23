import { useEffect, useRef } from "react";
import { useLightboxStore } from "~/stores/lightboxStore";
import { useGalleryStore } from "~/stores/galleryStore";

const HASH_PREFIX = "#img-";

export function useLightboxUrlSync() {
  const lightboxTarget = useLightboxStore((s) => s.lightboxTarget);
  const setLightboxTarget = useLightboxStore((s) => s.setLightboxTarget);
  const closeLightbox = useLightboxStore((s) => s.closeLightbox);
  const items = useGalleryStore((s) => s.items);
  const hasLoaded = useGalleryStore((s) => s.hasLoaded);

  // Keep a ref so the popstate handler always sees fresh items without re-registering
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Sync lightboxTarget → URL hash
  useEffect(() => {
    if (lightboxTarget?.kind === "gallery") {
      const newHash = HASH_PREFIX + lightboxTarget.imageId;
      if (window.location.hash !== newHash) {
        history.pushState(null, "", newHash);
      }
    } else if (!lightboxTarget && window.location.hash.startsWith(HASH_PREFIX)) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [lightboxTarget]);

  // Sync URL hash → lightboxTarget (handles Back/Forward)
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash;
      if (hash.startsWith(HASH_PREFIX)) {
        const imageId = hash.slice(HASH_PREFIX.length);
        const item = itemsRef.current.find((i) => i.id === imageId && i.status === "completed");
        if (item) {
          setLightboxTarget({ kind: "gallery", imageId });
        } else {
          closeLightbox();
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      } else {
        closeLightbox();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setLightboxTarget, closeLightbox]);

  // Open lightbox from URL hash on initial load (handles reload / direct navigation)
  const hasHandledInitialHash = useRef(false);
  useEffect(() => {
    if (!hasLoaded || hasHandledInitialHash.current) return;
    const hash = window.location.hash;
    if (!hash.startsWith(HASH_PREFIX)) return;
    const imageId = hash.slice(HASH_PREFIX.length);
    const item = items.find((i) => i.id === imageId && i.status === "completed");
    if (item) {
      hasHandledInitialHash.current = true;
      setLightboxTarget({ kind: "gallery", imageId });
    }
  }, [hasLoaded, items, setLightboxTarget]);
}
