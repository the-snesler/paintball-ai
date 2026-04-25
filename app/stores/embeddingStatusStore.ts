import { create } from "zustand";

export type ModelLoadState = "idle" | "downloading" | "ready" | "error";

interface EmbeddingStatusState {
  modelLoadState: ModelLoadState;
  modelDownloadProgress: number; // 0..1
  modelDownloadBytes: { loaded: number; total: number } | null;
  modelId: string | null;
  indexed: number;
  total: number;
  lastError: string | null;
  errorCount: number;

  setModelLoadState: (state: ModelLoadState) => void;
  setModelDownloadProgress: (progress: number, bytes?: { loaded: number; total: number }) => void;
  setModelReady: (modelId: string) => void;
  setModelError: (error: string) => void;
  setCounts: (indexed: number, total: number) => void;
  reportEmbedSuccess: () => void;
  reportEmbedError: (message: string) => void;
  clearErrors: () => void;
}

export const useEmbeddingStatusStore = create<EmbeddingStatusState>()((set) => ({
  modelLoadState: "idle",
  modelDownloadProgress: 0,
  modelDownloadBytes: null,
  modelId: null,
  indexed: 0,
  total: 0,
  lastError: null,
  errorCount: 0,

  setModelLoadState: (modelLoadState) => set({ modelLoadState }),
  setModelDownloadProgress: (progress, bytes) =>
    set({
      modelLoadState: "downloading",
      modelDownloadProgress: progress,
      modelDownloadBytes: bytes ?? null,
    }),
  setModelReady: (modelId) =>
    set({
      modelLoadState: "ready",
      modelId,
      modelDownloadProgress: 1,
    }),
  setModelError: (error) =>
    set((s) => ({
      modelLoadState: "error",
      lastError: error,
      errorCount: s.errorCount + 1,
    })),
  setCounts: (indexed, total) => set({ indexed, total }),
  reportEmbedSuccess: () => set((s) => ({ indexed: s.indexed + 1 })),
  reportEmbedError: (message) =>
    set((s) => ({ lastError: message, errorCount: s.errorCount + 1 })),
  clearErrors: () => set({ lastError: null, errorCount: 0 }),
}));
