import { create } from "zustand";
import type { LightboxTarget } from "~/types";
import { transitionLightbox } from "~/lib/lightboxTransition";

interface LightboxState {
  isLightboxOpen: boolean;
  lightboxTarget: LightboxTarget | null;
  openLightbox: (target: LightboxTarget) => void;
  closeLightbox: () => void;
  setLightboxTarget: (target: LightboxTarget | null) => void;
}

export const useLightboxStore = create<LightboxState>()((set, get) => ({
  isLightboxOpen: false,
  lightboxTarget: null,

  openLightbox: (lightboxTarget) => get().setLightboxTarget(lightboxTarget),

  closeLightbox: () => get().setLightboxTarget(null),

  setLightboxTarget: (lightboxTarget) =>
    transitionLightbox(get().lightboxTarget, lightboxTarget, () =>
      set({
        lightboxTarget,
        isLightboxOpen: lightboxTarget !== null,
      })
    ),
}));
