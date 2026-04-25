import { create } from "zustand";
import { deleteEditorSession, getSessionById, upsertEditorSession } from "~/lib/db";
import { hydrateStoredSession } from "~/lib/editorSession";
import type { EditorTurn, ReferenceImage, StoredEditorSession } from "~/types";

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
  instructionBasePrompt: string | null;

  // Analysis
  isAnalyzing: boolean;
  analysisResult: string | null;

  // Reference images (additional, beyond the source)
  referenceImages: ReferenceImage[];

  // Generation state
  isGenerating: boolean;

  // Session persistence
  currentSessionId: string | null;

  // Transient navigation hint: lets entry points (e.g. lightbox upscale button)
  // ask the editor sidebar to open a specific panel on the next mount/visit.
  // Consumers should clear this after reading.
  pendingFocusedPanel: "upscalers" | null;

  // Actions
  setSource: (params: {
    blob: Blob;
    prompt: string;
    galleryItemId?: string;
    referenceId: string;
  }) => void;
  hydrateSession: (params: {
    sessionId: string;
    sourceBlob: Blob;
    sourceUrl: string;
    sourcePrompt: string;
    sourceGalleryItemId: string | null;
    sourceReferenceId: string | null;
    turns: EditorTurn[];
    selectedItemId: string | null;
    referenceImages: ReferenceImage[];
  }) => void;
  addTurn: (turn: Omit<EditorTurn, "itemIds">) => void;
  addItemToTurn: (turnId: string, itemId: string) => void;
  selectItem: (id: string | null) => void;
  setInstruction: (text: string) => void;
  setInstructionBasePrompt: (text: string | null) => void;
  setAnalyzing: (val: boolean) => void;
  setAnalysisResult: (text: string | null) => void;
  setIsGenerating: (val: boolean) => void;
  setPendingFocusedPanel: (panel: "upscalers" | null) => void;
  addReferenceImage: (image: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  reorderReferenceImages: (fromId: string, toId: string) => void;
  setTurnContextBrief: (turnId: string, brief: string) => void;
  setTurnSentInstruction: (turnId: string, sentInstruction: string) => void;
  clearReferenceImages: () => void;
  /**
   * Restore a session by ID while already on the editor page. Saves the current
   * session first, then hydrates the target session in place.
   */
  restoreSession: (sessionId: string) => Promise<void>;
  /**
   * Save the current session (if any) and clear in-memory state without deleting
   * the session from the DB. Call this before restoring a different session so the
   * active session isn't lost and EditorView can start from a clean store.
   */
  clearForSessionRestore: () => void;
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
  instructionBasePrompt: null as string | null,
  referenceImages: [],
  isAnalyzing: false,
  analysisResult: null,
  isGenerating: false,
  currentSessionId: null,
  pendingFocusedPanel: null as "upscalers" | null,
};

export const useEditorStore = create<EditorState>()((set, get) => {
  function buildStoredSession(state: EditorState, id: string): StoredEditorSession {
    return {
      id,
      sourceGalleryItemId: state.sourceGalleryItemId,
      sourceReferenceId: state.sourceReferenceId,
      sourcePrompt: state.sourcePrompt,
      turns: state.turns
        .filter((t) => t.sourceReferenceId != null)
        .map((t) => ({
          id: t.id,
          instruction: t.instruction,
          sentInstruction: t.sentInstruction,
          sourceItemId: t.sourceItemId,
          sourceReferenceId: t.sourceReferenceId!,
          itemIds: t.itemIds,
          createdAt: t.createdAt,
          contextBrief: t.contextBrief,
        })),
      selectedItemId: state.selectedItemId,
      additionalReferenceIds: state.referenceImages.map((r) => r.id),
      savedAt: Date.now(),
    };
  }

  function persistSession() {
    const s = get();
    if (!s.sourceReferenceId && !s.sourceGalleryItemId) return;
    const id = s.currentSessionId ?? crypto.randomUUID();
    if (!s.currentSessionId) {
      set({ currentSessionId: id });
      localStorage.setItem("editorSessionId", id);
    }
    // Sync back the actual stored ID in case upsert reused an existing session's ID
    // (e.g. when navigating to an image that already has a saved session).
    void upsertEditorSession(buildStoredSession(get(), id)).then((actualId) => {
      if (actualId !== get().currentSessionId) {
        set({ currentSessionId: actualId });
        localStorage.setItem("editorSessionId", actualId);
      }
    });
  }

  return {
    ...INITIAL_STATE,

    setSource: ({ blob, prompt, galleryItemId, referenceId }) => {
      const prev = get();

      // Save previous session before wiping state
      if (prev.sourceReferenceId ?? prev.sourceGalleryItemId) {
        const prevId = prev.currentSessionId ?? crypto.randomUUID();
        void upsertEditorSession(buildStoredSession(prev, prevId));
      }

      if (prev.sourceUrl) URL.revokeObjectURL(prev.sourceUrl);
      prev.referenceImages.forEach((img) => URL.revokeObjectURL(img.url));

      const newSessionId = crypto.randomUUID();
      set({
        sourceBlob: blob,
        sourceUrl: URL.createObjectURL(blob),
        sourcePrompt: prompt,
        sourceGalleryItemId: galleryItemId ?? null,
        sourceReferenceId: referenceId,
        turns: [],
        selectedItemId: null,
        instruction: "",
        instructionBasePrompt: null,
        referenceImages: [],
        analysisResult: null,
        isGenerating: false,
        currentSessionId: newSessionId,
      });
      localStorage.setItem("editorSessionId", newSessionId);
      persistSession();
    },

    hydrateSession: ({
      sessionId,
      sourceBlob,
      sourceUrl,
      sourcePrompt,
      sourceGalleryItemId,
      sourceReferenceId,
      turns,
      selectedItemId,
      referenceImages,
    }) => {
      const prev = get();
      if (prev.sourceUrl) URL.revokeObjectURL(prev.sourceUrl);
      prev.referenceImages.forEach((img) => URL.revokeObjectURL(img.url));

      set({
        sourceBlob,
        sourceUrl,
        sourcePrompt,
        sourceGalleryItemId,
        sourceReferenceId,
        turns,
        selectedItemId,
        referenceImages,
        instruction: "",
        instructionBasePrompt: null,
        analysisResult: null,
        isGenerating: false,
        isAnalyzing: false,
        currentSessionId: sessionId,
      });
      localStorage.setItem("editorSessionId", sessionId);
    },

    addTurn: (turn) => {
      set((state) => ({
        turns: [...state.turns, { ...turn, itemIds: [] }],
      }));
      persistSession();
    },

    addItemToTurn: (turnId, itemId) => {
      set((state) => ({
        turns: state.turns.map((t) =>
          t.id === turnId ? { ...t, itemIds: [...t.itemIds, itemId] } : t
        ),
      }));
      persistSession();
    },

    selectItem: (selectedItemId) => {
      set({ selectedItemId });
      persistSession();
    },

    setTurnContextBrief: (turnId, brief) => {
      set((state) => ({
        turns: state.turns.map((t) => (t.id === turnId ? { ...t, contextBrief: brief } : t)),
      }));
      persistSession();
    },

    setTurnSentInstruction: (turnId, sentInstruction) => {
      set((state) => ({
        turns: state.turns.map((t) => (t.id === turnId ? { ...t, sentInstruction } : t)),
      }));
      persistSession();
    },

    setInstruction: (instruction) =>
      set((state) => ({
        instruction,
        instructionBasePrompt: instruction.length === 0 ? null : state.instructionBasePrompt,
      })),

    setInstructionBasePrompt: (instructionBasePrompt) => set({ instructionBasePrompt }),

    setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

    setAnalysisResult: (analysisResult) => set({ analysisResult }),

    setIsGenerating: (isGenerating) => set({ isGenerating }),

    setPendingFocusedPanel: (pendingFocusedPanel) => set({ pendingFocusedPanel }),

    addReferenceImage: (image) => {
      set((state) => ({
        referenceImages: [...state.referenceImages, image],
      }));
      persistSession();
    },

    removeReferenceImage: (id) => {
      set((state) => {
        const image = state.referenceImages.find((entry) => entry.id === id);
        if (image) URL.revokeObjectURL(image.url);
        return {
          referenceImages: state.referenceImages.filter((entry) => entry.id !== id),
        };
      });
      persistSession();
    },

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

    restoreSession: async (sessionId: string) => {
      const session = await getSessionById(sessionId);
      if (!session) return;
      // Save outgoing session before replacing
      const prev = get();
      if (prev.sourceReferenceId ?? prev.sourceGalleryItemId) {
        const id = prev.currentSessionId ?? crypto.randomUUID();
        void upsertEditorSession(buildStoredSession(prev, id));
      }
      const hydrated = await hydrateStoredSession(session);
      if (!hydrated) return;
      get().hydrateSession(hydrated);
    },

    clearForSessionRestore: () => {
      const prev = get();
      // Save the outgoing session before clearing so it isn't lost
      if (prev.sourceReferenceId ?? prev.sourceGalleryItemId) {
        const id = prev.currentSessionId ?? crypto.randomUUID();
        void upsertEditorSession(buildStoredSession(prev, id));
      }
      if (prev.sourceUrl) URL.revokeObjectURL(prev.sourceUrl);
      prev.referenceImages.forEach((img) => URL.revokeObjectURL(img.url));
      set(INITIAL_STATE);
    },

    reset: () => {
      const prev = get();
      if (prev.sourceUrl) URL.revokeObjectURL(prev.sourceUrl);
      prev.referenceImages.forEach((img) => URL.revokeObjectURL(img.url));
      if (prev.currentSessionId) {
        void deleteEditorSession(prev.currentSessionId);
        localStorage.removeItem("editorSessionId");
      }
      set(INITIAL_STATE);
    },
  };
});
