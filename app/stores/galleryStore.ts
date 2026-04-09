import { create } from "zustand";
import type {
  GalleryItem,
  ViewMode,
  CompletedGalleryItem,
  CompletedGalleryItemFields,
  FailedGalleryItemFields,
  PendingGalleryItemFields,
} from "~/types";
import { getAllImages, deleteImage as dbDeleteImage, toDisplayImage } from "~/lib/db";
import { useLightboxStore } from "./lightboxStore";

interface GalleryState {
  items: GalleryItem[];
  viewMode: ViewMode;
  selectedItemIds: string[];
  lastSelectedId: string | null;
  isLoading: boolean;
  hasLoaded: boolean;

  loadImages: () => Promise<void>;
  addItem: (item: GalleryItem) => void;
  addItems: (items: GalleryItem[]) => void;
  updateItem: (
    id: string,
    updates: PendingGalleryItemFields | CompletedGalleryItemFields | FailedGalleryItemFields
  ) => void;
  deleteItem: (id: string) => Promise<void>;
  dismissItem: (id: string) => void;
  getItem: (id: string) => GalleryItem | undefined;
  setViewMode: (mode: ViewMode) => void;
  toggleItemSelection: (id: string) => void;
  selectItemRange: (id: string) => void;
  clearSelection: () => void;
  deleteSelectedItems: () => Promise<number>;
  downloadSelectedItems: () => number;
}

export const useGalleryStore = create<GalleryState>()((set, get) => ({
  items: [],
  viewMode: "grid",
  selectedItemIds: [],
  lastSelectedId: null,
  isLoading: false,
  hasLoaded: false,

  loadImages: async () => {
    set({ isLoading: true });
    try {
      const storedImages = await getAllImages();
      const items = storedImages.map((img) => toDisplayImage(img));
      set({ items, hasLoaded: true });
    } catch (error) {
      console.error("Failed to load images:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: (item) =>
    set((state) => ({
      items: [item, ...state.items],
    })),

  addItems: (newItems) =>
    set((state) => ({
      items: [...newItems, ...state.items],
    })),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    })),

  deleteItem: async (id) => {
    const state = get();
    const item = state.items.find((i) => i.id === id);

    try {
      await dbDeleteImage(id);
      if (item?.status === "completed") {
        URL.revokeObjectURL(item.originalUrl);
        URL.revokeObjectURL(item.thumbnailUrl);
      }
      const lightboxTarget = useLightboxStore.getState().lightboxTarget;
      const shouldCloseLightbox =
        lightboxTarget?.kind === "gallery" && lightboxTarget.imageId === id;

      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        selectedItemIds: state.selectedItemIds.filter((selectedId) => selectedId !== id),
      }));
      if (shouldCloseLightbox) {
        useLightboxStore.getState().closeLightbox();
      }
    } catch (error) {
      console.error("Failed to delete image:", error);
      throw error;
    }
  },

  dismissItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),

  getItem: (id) => get().items.find((i) => i.id === id),

  setViewMode: (viewMode) => set({ viewMode }),

  toggleItemSelection: (id) =>
    set((state) => {
      const item = state.items.find((entry) => entry.id === id);
      if (!item || item.status !== "completed") {
        return state;
      }

      const isSelected = state.selectedItemIds.includes(id);
      return {
        selectedItemIds: isSelected
          ? state.selectedItemIds.filter((selectedId) => selectedId !== id)
          : [...state.selectedItemIds, id],
        lastSelectedId: id,
      };
    }),

  selectItemRange: (id) =>
    set((state) => {
      const item = state.items.find((entry) => entry.id === id);
      if (!item || item.status !== "completed") {
        return state;
      }

      const completedItems = state.items.filter(
        (i): i is CompletedGalleryItem => i.status === "completed"
      );

      const anchorIndex = state.lastSelectedId
        ? completedItems.findIndex((i) => i.id === state.lastSelectedId)
        : -1;

      // No anchor — fall back to single select
      if (anchorIndex === -1) {
        const isSelected = state.selectedItemIds.includes(id);
        return {
          selectedItemIds: isSelected
            ? state.selectedItemIds.filter((sid) => sid !== id)
            : [...state.selectedItemIds, id],
          lastSelectedId: id,
        };
      }

      const targetIndex = completedItems.findIndex((i) => i.id === id);
      if (targetIndex === -1) return state;

      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const rangeIds = completedItems.slice(start, end + 1).map((i) => i.id);

      const merged = new Set([...state.selectedItemIds, ...rangeIds]);
      return {
        selectedItemIds: Array.from(merged),
        lastSelectedId: id,
      };
    }),

  clearSelection: () => set({ selectedItemIds: [], lastSelectedId: null }),

  deleteSelectedItems: async () => {
    const state = get();
    const selectedSet = new Set(state.selectedItemIds);
    const selectedItems = state.items.filter(
      (item): item is CompletedGalleryItem =>
        item.status === "completed" && selectedSet.has(item.id)
    );

    if (selectedItems.length === 0) {
      return 0;
    }

    await Promise.all(selectedItems.map((item) => dbDeleteImage(item.id)));
    selectedItems.forEach((item) => {
      URL.revokeObjectURL(item.originalUrl);
      URL.revokeObjectURL(item.thumbnailUrl);
    });

    const lightboxTarget = useLightboxStore.getState().lightboxTarget;
    const shouldCloseLightbox =
      lightboxTarget?.kind === "gallery" && selectedSet.has(lightboxTarget.imageId);

    set((currentState) => ({
      items: currentState.items.filter((item) => !selectedSet.has(item.id)),
      selectedItemIds: [],
    }));
    if (shouldCloseLightbox) {
      useLightboxStore.getState().closeLightbox();
    }

    return selectedItems.length;
  },

  downloadSelectedItems: () => {
    const state = get();
    const selectedSet = new Set(state.selectedItemIds);
    const selectedItems = state.items.filter(
      (item): item is CompletedGalleryItem =>
        item.status === "completed" && selectedSet.has(item.id)
    );

    selectedItems.forEach((item, index) => {
      const extension = getBlobExtension(item.originalBlob);
      const link = document.createElement("a");
      link.href = item.originalUrl;
      link.download = `${sanitizeFilename(item.modelName)}-${item.createdAt}-${index + 1}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    return selectedItems.length;
  },
}));

function sanitizeFilename(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "image"
  );
}

function getBlobExtension(blob: Blob): string {
  const type = blob.type.toLowerCase();

  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  return "png";
}
