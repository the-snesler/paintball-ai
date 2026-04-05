import { create } from "zustand";
import type { EditorTurn } from "~/types";

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
  isAnalyzing: false,
  analysisResult: null,
  isGenerating: false,
};

export const useEditorStore = create<EditorState>()((set, get) => ({
  ...INITIAL_STATE,

  setSource: ({ blob, prompt, galleryItemId, referenceId }) => {
    const prev = get();
    if (prev.sourceUrl) URL.revokeObjectURL(prev.sourceUrl);
    set({
      sourceBlob: blob,
      sourceUrl: URL.createObjectURL(blob),
      sourcePrompt: prompt,
      sourceGalleryItemId: galleryItemId ?? null,
      sourceReferenceId: referenceId,
      turns: [],
      selectedItemId: null,
      instruction: "",
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

  setInstruction: (instruction) => set({ instruction }),

  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  setAnalysisResult: (analysisResult) => set({ analysisResult }),

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  reset: () => {
    const { sourceUrl } = get();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    set(INITIAL_STATE);
  },
}));
