import { create } from "zustand";
import type { EditorTurn, ReferenceImage } from "~/types";

interface EditorState {
  // Source image
  sourceBlob: Blob | null;
  sourceUrl: string | null;
  sourcePrompt: string;
  sourceGalleryItemId: string | null;
  sourceReferenceId: string | null; // ID saved to references store for retry support

  // Conversation
  turns: EditorTurn[];
  selectedItemId: string | null; // which gallery item is the active canvas

  // Input
  instruction: string;

  // Analysis
  isAnalyzing: boolean;
  analysisResult: string | null;

  // Reference images (additional, beyond the source)
  referenceImages: ReferenceImage[];

  // Generation state
  isGenerating: boolean;

  // Actions
  setSource: (params: {
    blob: Blob;
    prompt: string;
    galleryItemId?: string;
    referenceId: string;
  }) => void;
  addTurn: (turn: Omit<EditorTurn, "itemIds">) => void;
  addItemToTurn: (turnId: string, itemId: string) => void;
  selectItem: (id: string | null) => void;
  setInstruction: (text: string) => void;
  setAnalyzing: (val: boolean) => void;
  setAnalysisResult: (text: string | null) => void;
  setIsGenerating: (val: boolean) => void;
  addReferenceImage: (image: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  reorderReferenceImages: (fromId: string, toId: string) => void;
  setTurnContextBrief: (turnId: string, brief: string) => void;
  clearReferenceImages: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  sourceBlob: null,
  sourceUrl: null,
  sourcePrompt: "",
  sourceGalleryItemId: null,
  sourceReferenceId: null,
  turns: [],
  selectedItemId: null,
  instruction: "",
  referenceImages: [],
  isAnalyzing: false,
  analysisResult: null,
  isGenerating: false,
};

export const useEditorStore = create<EditorState>()((set, get) => ({
  ...INITIAL_STATE,

  setSource: ({ blob, prompt, galleryItemId, referenceId }) => {
    const prev = get();
    if (prev.sourceUrl) URL.revokeObjectURL(prev.sourceUrl);
    prev.referenceImages.forEach((img) => URL.revokeObjectURL(img.url));
    set({
      sourceBlob: blob,
      sourceUrl: URL.createObjectURL(blob),
      sourcePrompt: prompt,
      sourceGalleryItemId: galleryItemId ?? null,
      sourceReferenceId: referenceId,
      turns: [],
      selectedItemId: null,
      instruction: "",
      referenceImages: [],
      analysisResult: null,
      isGenerating: false,
    });
  },

  addTurn: (turn) =>
    set((state) => ({
      turns: [...state.turns, { ...turn, itemIds: [] }],
    })),

  addItemToTurn: (turnId, itemId) =>
    set((state) => ({
      turns: state.turns.map((t) =>
        t.id === turnId ? { ...t, itemIds: [...t.itemIds, itemId] } : t
      ),
    })),

  selectItem: (selectedItemId) => set({ selectedItemId }),

  setTurnContextBrief: (turnId, brief) =>
    set((state) => ({
      turns: state.turns.map((t) =>
        t.id === turnId ? { ...t, contextBrief: brief } : t
      ),
    })),

  setInstruction: (instruction) => set({ instruction }),

  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  setAnalysisResult: (analysisResult) => set({ analysisResult }),

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  addReferenceImage: (image) =>
    set((state) => ({
      referenceImages: [...state.referenceImages, image],
    })),

  removeReferenceImage: (id) =>
    set((state) => {
      const image = state.referenceImages.find((entry) => entry.id === id);
      if (image) URL.revokeObjectURL(image.url);
      return {
        referenceImages: state.referenceImages.filter((entry) => entry.id !== id),
      };
    }),

  reorderReferenceImages: (fromId, toId) =>
    set((state) => {
      const images = [...state.referenceImages];
      const fromIndex = images.findIndex((img) => img.id === fromId);
      const toIndex = images.findIndex((img) => img.id === toId);
      if (fromIndex === -1 || toIndex === -1) return {};
      const [moved] = images.splice(fromIndex, 1);
      images.splice(toIndex, 0, moved);
      return { referenceImages: images };
    }),

  clearReferenceImages: () =>
    set((state) => {
      state.referenceImages.forEach((image) => URL.revokeObjectURL(image.url));
      return { referenceImages: [] };
    }),

  reset: () => {
    const prev = get();
    if (prev.sourceUrl) URL.revokeObjectURL(prev.sourceUrl);
    prev.referenceImages.forEach((img) => URL.revokeObjectURL(img.url));
    set(INITIAL_STATE);
  },
}));
