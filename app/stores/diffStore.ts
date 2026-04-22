import { create } from "zustand";

export interface DiffTarget {
  parentBlob: Blob;
  childBlob: Blob;
  parentLabel?: string;
  childLabel?: string;
}

interface DiffState {
  isOpen: boolean;
  target: DiffTarget | null;
  openDiff: (target: DiffTarget) => void;
  closeDiff: () => void;
}

export const useDiffStore = create<DiffState>()((set) => ({
  isOpen: false,
  target: null,

  openDiff: (target) => set({ target, isOpen: true }),

  closeDiff: () => set({ isOpen: false, target: null }),
}));
