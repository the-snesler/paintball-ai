import { create } from "zustand";
import type {
  GalleryItem,
  CompletedGalleryItem,
  CompletedGalleryItemFields,
  FailedGalleryItemFields,
  PendingGalleryItemFields,
} from "~/types";
import {
  getImagesPaginated,
  getImageCount,
  PAGE_SIZE,
  deleteImage as dbDeleteImage,
  deleteReferenceImage,
  toDisplayImage,
} from "~/lib/db";
import { useLightboxStore } from "./lightboxStore";

function getOrphanedReferenceIds(removingIds: Set<string>, allItems: GalleryItem[]): string[] {
  const removingRefs = new Set(
    allItems.filter((i) => removingIds.has(i.id)).flatMap((i) => i.referenceImageIds)
  );
  const remainingRefs = new Set(
    allItems.filter((i) => !removingIds.has(i.id)).flatMap((i) => i.referenceImageIds)
  );
  return [...removingRefs].filter((id) => !remainingRefs.has(id));
}

interface GalleryState {
  items: GalleryItem[];
  selectedItemIds: string[];
  lastSelectedId: string | null;
  isLoading: boolean;
  hasLoaded: boolean;
  dbOffset: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  totalCount: number;
  searchQuery: string;

  loadImages: () => Promise<void>;
  loadMoreImages: () => Promise<void>;
  addItem: (item: GalleryItem) => void;
  addItems: (items: GalleryItem[]) => void;
  updateItem: (
    id: string,
    updates: PendingGalleryItemFields | CompletedGalleryItemFields | FailedGalleryItemFields
  ) => void;
  deleteItem: (id: string) => Promise<void>;
  dismissItem: (id: string) => void;
  getItem: (id: string) => GalleryItem | undefined;
  toggleItemSelection: (id: string) => void;
  selectItemRange: (id: string) => void;
  clearSelection: () => void;
  deleteSelectedItems: () => Promise<number>;
  downloadSelectedItems: () => number;
  setSearchQuery: (query: string) => void;
}

export const useGalleryStore = create<GalleryState>()((set, get) => ({
  items: [],
  selectedItemIds: [],
  lastSelectedId: null,
  isLoading: false,
  hasLoaded: false,
  dbOffset: 0,
  hasMore: false,
  isLoadingMore: false,
  totalCount: 0,
  searchQuery: "",

  loadImages: async () => {
    set({ isLoading: true });
    try {
      const [storedImages, total] = await Promise.all([
        getImagesPaginated(PAGE_SIZE, 0),
        getImageCount(),
      ]);
      const items = storedImages.map((img) => toDisplayImage(img));
      set({
        items,
        hasLoaded: true,
        dbOffset: PAGE_SIZE,
        hasMore: storedImages.length >= PAGE_SIZE,
        totalCount: total,
      });
    } catch (error) {
      console.error("Failed to load images:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadMoreImages: async () => {
    const { dbOffset, hasMore, isLoadingMore } = get();
    if (!hasMore || isLoadingMore) return;

    set({ isLoadingMore: true });
    try {
      const records = await getImagesPaginated(PAGE_SIZE, dbOffset);
      const newItems = records.map(toDisplayImage);

      const existingIds = new Set(get().items.map((i) => i.id));
      const fresh = newItems.filter((item) => !existingIds.has(item.id));

      set((state) => ({
        items: [...state.items, ...fresh],
        dbOffset: state.dbOffset + records.length,
        hasMore: records.length >= PAGE_SIZE,
      }));
    } catch (error) {
      console.error("Failed to load more images:", error);
    } finally {
      set({ isLoadingMore: false });
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
    set((state) => {
      const existing = state.items.find((item) => item.id === id);
      const becomingCompleted =
        updates.status === "completed" && existing?.status !== "completed";
      return {
        items: state.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        totalCount: becomingCompleted ? state.totalCount + 1 : state.totalCount,
      };
    }),

  deleteItem: async (id) => {
    const state = get();
    const item = state.items.find((i) => i.id === id);
    const orphanedRefIds = getOrphanedReferenceIds(new Set([id]), state.items);

    try {
      await dbDeleteImage(id);
      if (item?.status === "completed") {
        URL.revokeObjectURL(item.originalUrl);
        URL.revokeObjectURL(item.thumbnailUrl);
      }
      const lightboxTarget = useLightboxStore.getState().lightboxTarget;
      const shouldCloseLightbox =
        lightboxTarget?.kind === "gallery" && lightboxTarget.imageId === id;

      const wasCompleted = item?.status === "completed";
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        selectedItemIds: state.selectedItemIds.filter((selectedId) => selectedId !== id),
        totalCount: wasCompleted ? state.totalCount - 1 : state.totalCount,
      }));
      if (shouldCloseLightbox) {
        useLightboxStore.getState().closeLightbox();
      }
      await Promise.all(orphanedRefIds.map((refId) => deleteReferenceImage(refId)));
    } catch (error) {
      console.error("Failed to delete image:", error);
      throw error;
    }
  },

  dismissItem: (id) => {
    const state = get();
    const orphanedRefIds = getOrphanedReferenceIds(new Set([id]), state.items);
    void Promise.all(orphanedRefIds.map((refId) => deleteReferenceImage(refId)));
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  getItem: (id) => get().items.find((i) => i.id === id),

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

  setSearchQuery: (query) => set({ searchQuery: query }),

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

    const orphanedRefIds = getOrphanedReferenceIds(selectedSet, state.items);

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
      totalCount: currentState.totalCount - selectedItems.length,
    }));
    if (shouldCloseLightbox) {
      useLightboxStore.getState().closeLightbox();
    }
    await Promise.all(orphanedRefIds.map((refId) => deleteReferenceImage(refId)));

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
