import { flushSync } from "react-dom";
import type { LightboxTarget } from "~/types";

let activeTransition: { transition: ViewTransition; cleanup: () => void } | undefined;

export function transitionLightbox(
  previous: LightboxTarget | null,
  next: LightboxTarget | null,
  update: () => void
) {
  activeTransition?.transition.skipTransition();
  activeTransition?.cleanup();
  activeTransition = undefined;

  const target = previous ?? next;
  if (
    typeof document === "undefined" ||
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    Boolean(previous) === Boolean(next) ||
    target?.kind !== "gallery"
  ) {
    update();
    return;
  }

  // Scope to the gallery: related cards in the lightbox reuse ImageCard too.
  const thumbnail = Array.from(
    document.querySelectorAll<HTMLImageElement>("[data-gallery-view] [data-gallery-image]")
  ).find((image) => image.dataset.galleryImage === target.imageId);
  const gallery = thumbnail?.closest<HTMLElement>("[data-gallery-view]");
  const bounds = thumbnail?.getBoundingClientRect();
  const viewport = gallery?.getBoundingClientRect();
  const hasThumbnail = Boolean(
    thumbnail?.complete &&
    thumbnail.naturalWidth &&
    bounds &&
    viewport &&
    bounds.width &&
    bounds.height &&
    bounds.bottom > Math.max(0, viewport.top) &&
    bounds.top < Math.min(window.innerHeight, viewport.bottom) &&
    bounds.right > Math.max(0, viewport.left) &&
    bounds.left < Math.min(window.innerWidth, viewport.right)
  );

  const namedElements: HTMLElement[] = [];
  const name = (element: HTMLElement | null | undefined, value: string) => {
    if (!element) return;
    element.style.viewTransitionName = value;
    namedElements.push(element);
  };
  const cleanup = () => {
    namedElements.forEach((element) => element.style.removeProperty("view-transition-name"));
    document.documentElement.classList.remove("lightbox-transition");
  };
  const nameLightbox = () => {
    name(document.querySelector<HTMLElement>("[data-lightbox]"), "lightbox-shell");
    if (hasThumbnail) {
      name(document.querySelector<HTMLImageElement>("[data-lightbox-image]"), "lightbox-image");
    }
  };

  document.documentElement.classList.add("lightbox-transition");
  if (previous) nameLightbox();
  else if (hasThumbnail) name(thumbnail, "lightbox-image");

  const transition = document.startViewTransition(async () => {
    // A newer action may have superseded this update before capture finished.
    if (activeTransition?.transition !== transition) return;
    namedElements.forEach((element) => element.style.removeProperty("view-transition-name"));
    flushSync(update);
    if (next) {
      // Hold the gallery snapshot until the original is decoded and sized.
      await document
        .querySelector<HTMLImageElement>("[data-lightbox-image]")
        ?.decode()
        .catch(() => {});
    }
    if (activeTransition?.transition !== transition) return;
    if (next) nameLightbox();
    else if (hasThumbnail && thumbnail?.isConnected) name(thumbnail, "lightbox-image");
  });
  activeTransition = { transition, cleanup };
  void transition.ready.catch(() => {}); // A skipped capture still applies the update.
  void transition.finished
    .finally(() => {
      if (activeTransition?.transition !== transition) return;
      cleanup();
      activeTransition = undefined;
    })
    .catch(() => {});
}
