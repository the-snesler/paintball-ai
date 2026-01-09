import { create } from 'zustand';
import type { AspectRatio, Resolution, ReferenceImage, PendingGeneration } from '~/types';

interface GenerationState {
  prompt: string;
  modelSelections: Record<string, number>; // modelId -> count
  aspectRatio: AspectRatio;
  resolution: Resolution;
  referenceImages: ReferenceImage[];
  isGenerating: boolean;
  pendingGenerations: PendingGeneration[];

  setPrompt: (prompt: string) => void;
  setModelCount: (modelId: string, count: number) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setResolution: (resolution: Resolution) => void;
  addReferenceImage: (image: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;
  startGeneration: (pending: PendingGeneration[]) => void;
  updatePendingGeneration: (id: string, updates: Partial<PendingGeneration>) => void;
  completeGeneration: () => void;
  dismissFailedGeneration: (id: string) => void;
  getSelectedModelIds: () => string[];
  getTotalImageCount: () => number;
}

export const useGenerationStore = create<GenerationState>()((set, get) => ({
  prompt: '',
  modelSelections: {},
  aspectRatio: '1:1',
  resolution: '1K',
  referenceImages: [],
  isGenerating: false,
  pendingGenerations: [],

  setPrompt: (prompt) => set({ prompt }),

  setModelCount: (modelId, count) =>
    set((state) => ({
      modelSelections: {
        ...state.modelSelections,
        [modelId]: Math.max(0, count),
      },
    })),

  setAspectRatio: (aspectRatio) => set({ aspectRatio }),

  setResolution: (resolution) => set({ resolution }),

  addReferenceImage: (image) =>
    set((state) => ({
      referenceImages: [...state.referenceImages, image],
    })),

  removeReferenceImage: (id) =>
    set((state) => {
      const image = state.referenceImages.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.url);
      }
      return {
        referenceImages: state.referenceImages.filter((img) => img.id !== id),
      };
    }),

  clearReferenceImages: () =>
    set((state) => {
      state.referenceImages.forEach((img) => URL.revokeObjectURL(img.url));
      return { referenceImages: [] };
    }),

  startGeneration: (pending) =>
    set({
      isGenerating: true,
      pendingGenerations: pending,
    }),

  updatePendingGeneration: (id, updates) =>
    set((state) => ({
      pendingGenerations: state.pendingGenerations.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  completeGeneration: () =>
    set((state) => ({
      isGenerating: false,
      // Keep failed generations, only clear completed/generating ones
      pendingGenerations: state.pendingGenerations.filter(
        (p) => p.status === "failed"
      ),
    })),

  dismissFailedGeneration: (id) =>
    set((state) => ({
      pendingGenerations: state.pendingGenerations.filter((p) => p.id !== id),
    })),

  getSelectedModelIds: () => {
    const state = get();
    return Object.entries(state.modelSelections)
      .filter(([, count]) => count > 0)
      .map(([modelId]) => modelId);
  },

  getTotalImageCount: () => {
    const state = get();
    return Object.values(state.modelSelections).reduce((sum, count) => sum + count, 0);
  },
}));
