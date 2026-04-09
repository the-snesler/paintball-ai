import { create } from "zustand";
import type { AspectRatio, ReferenceImage, Resolution } from "~/types";

interface GenerationState {
  currentPrompt: string;
  currentModelSelections: Record<string, number>;
  currentAspectRatio: AspectRatio | null;
  currentResolution: Resolution;
  currentReferenceImages: ReferenceImage[];
  variationsEnabled: boolean;
  avoidPastVariations: boolean;
  isPreparingVariations: boolean;
  activeGenerationCount: number;
  activeGenerationSignatures: Record<string, number>;
  lastSubmittedSignature: string | null;
  isGenerating: boolean;

  setPrompt: (prompt: string) => void;
  setModelCount: (modelId: string, count: number) => void;
  setAspectRatio: (ratio: AspectRatio | null) => void;
  setResolution: (resolution: Resolution) => void;
  setVariationsEnabled: (enabled: boolean) => void;
  setAvoidPastVariations: (enabled: boolean) => void;
  setIsPreparingVariations: (enabled: boolean) => void;
  addReferenceImage: (image: ReferenceImage) => void;
  addReferenceImages: (images: ReferenceImage[]) => void;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;
  startGeneration: (signature: string) => void;
  finishGeneration: (signature: string) => void;
  resetDraft: () => void;
}

export const DEFAULT_GENERATION_STATE = {
  currentPrompt: "",
  currentModelSelections: {},
  currentAspectRatio: null,
  currentResolution: "1K" as Resolution,
  currentReferenceImages: [],
  variationsEnabled: false,
  avoidPastVariations: true,
};

export const useGenerationStore = create<GenerationState>()((set) => ({
  ...DEFAULT_GENERATION_STATE,
  isPreparingVariations: false,
  activeGenerationCount: 0,
  activeGenerationSignatures: {},
  lastSubmittedSignature: null,
  isGenerating: false,

  setPrompt: (currentPrompt) => set({ currentPrompt }),

  setModelCount: (modelId, count) =>
    set((state) => ({
      currentModelSelections: {
        ...state.currentModelSelections,
        [modelId]: Math.max(0, count),
      },
    })),

  setAspectRatio: (currentAspectRatio) => set({ currentAspectRatio }),

  setResolution: (currentResolution) => set({ currentResolution }),

  setVariationsEnabled: (variationsEnabled) => set({ variationsEnabled }),

  setAvoidPastVariations: (avoidPastVariations) => set({ avoidPastVariations }),

  setIsPreparingVariations: (isPreparingVariations) => set({ isPreparingVariations }),

  addReferenceImage: (image) =>
    set((state) => ({
      currentReferenceImages: [...state.currentReferenceImages, image],
    })),

  addReferenceImages: (images) =>
    set((state) => ({
      currentReferenceImages: [...state.currentReferenceImages, ...images],
    })),

  removeReferenceImage: (id) =>
    set((state) => {
      const image = state.currentReferenceImages.find((entry) => entry.id === id);
      if (image) {
        URL.revokeObjectURL(image.url);
      }
      return {
        currentReferenceImages: state.currentReferenceImages.filter((entry) => entry.id !== id),
      };
    }),

  clearReferenceImages: () =>
    set((state) => {
      state.currentReferenceImages.forEach((image) => URL.revokeObjectURL(image.url));
      return { currentReferenceImages: [] };
    }),

  startGeneration: (signature) =>
    set((state) => {
      const nextCount = state.activeGenerationCount + 1;
      return {
        activeGenerationCount: nextCount,
        activeGenerationSignatures: {
          ...state.activeGenerationSignatures,
          [signature]: (state.activeGenerationSignatures[signature] ?? 0) + 1,
        },
        lastSubmittedSignature: signature,
        isGenerating: nextCount > 0,
      };
    }),

  finishGeneration: (signature) =>
    set((state) => {
      const nextCount = Math.max(0, state.activeGenerationCount - 1);
      const currentSignatureCount = state.activeGenerationSignatures[signature] ?? 0;
      const nextSignatureCount = Math.max(0, currentSignatureCount - 1);
      const nextSignatures = { ...state.activeGenerationSignatures };

      if (nextSignatureCount === 0) {
        delete nextSignatures[signature];
      } else {
        nextSignatures[signature] = nextSignatureCount;
      }

      return {
        activeGenerationCount: nextCount,
        activeGenerationSignatures: nextSignatures,
        isGenerating: nextCount > 0,
      };
    }),

  resetDraft: () =>
    set((state) => {
      state.currentReferenceImages.forEach((image) => URL.revokeObjectURL(image.url));
      return {
        ...DEFAULT_GENERATION_STATE,
        isPreparingVariations: false,
      };
    }),
}));
