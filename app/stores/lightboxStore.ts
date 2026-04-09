import { create } from "zustand";
import type { LightboxTarget } from "~/types";

interface LightboxState {
  isLightboxOpen: boolean;
  lightboxTarget: LightboxTarget | null;
  openLightbox: (target: LightboxTarget) => void;
  closeLightbox: () => void;
  setLightboxTarget: (target: LightboxTarget | null) => void;
}

export const useLightboxStore = create<LightboxState>()((set) => ({
  isLightboxOpen: false,
  lightboxTarget: null,

  openLightbox: (lightboxTarget) =>
    set({
      lightboxTarget,
      isLightboxOpen: true,
    }),

  closeLightbox: () =>
    set({
      isLightboxOpen: false,
      lightboxTarget: null,
    }),

  setLightboxTarget: (lightboxTarget) =>
    set({
      lightboxTarget,
      isLightboxOpen: lightboxTarget !== null,
    }),
}));
