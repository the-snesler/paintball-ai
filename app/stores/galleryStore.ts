import { create } from 'zustand';
import type { GalleryItem, ViewMode, AspectRatio, Resolution, ReferenceImage, CompletedGalleryItem, CompletedGalleryItemFields, FailedGalleryItemFields, PendingGalleryItemFields } from '~/types';
import { getAllImages, deleteImage as dbDeleteImage } from '~/lib/db';

interface GalleryState {
  // Gallery items (unified pending + completed)
  items: GalleryItem[];
  viewMode: ViewMode;
  selectedImageId: string | null;
  isLightboxOpen: boolean;
  isLoading: boolean;
  hasLoaded: boolean;

  // Current input settings (for UI controls)
  currentPrompt: string;
  currentModelSelections: Record<string, number>;
  currentAspectRatio: AspectRatio;
  currentResolution: Resolution;
  currentReferenceImages: ReferenceImage[];
  isGenerating: boolean;

  // Gallery actions
  loadImages: () => Promise<void>;
  addItem: (item: GalleryItem) => void;
  addItems: (items: GalleryItem[]) => void;
  updateItem: (id: string, updates: PendingGalleryItemFields | CompletedGalleryItemFields | FailedGalleryItemFields) => void;
  deleteItem: (id: string) => Promise<void>;
  dismissItem: (id: string) => void;
  setViewMode: (mode: ViewMode) => void;
  openLightbox: (imageId: string) => void;
  closeLightbox: () => void;
  navigateLightbox: (direction: 'prev' | 'next') => void;
  getSelectedItem: () => CompletedGalleryItem | null;
  getCompletedItems: () => CompletedGalleryItem[];
  getItemsByDate: () => Map<string, CompletedGalleryItem[]>;

  // Input settings actions
  setPrompt: (prompt: string) => void;
  setModelCount: (modelId: string, count: number) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setResolution: (resolution: Resolution) => void;
  addReferenceImage: (image: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;
  setGenerating: (isGenerating: boolean) => void;
  getSelectedModelIds: () => string[];
  getTotalImageCount: () => number;
}

function formatDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export const useGalleryStore = create<GalleryState>()((set, get) => ({
  // Gallery state
  items: [],
  viewMode: 'grid',
  selectedImageId: null,
  isLightboxOpen: false,
  isLoading: false,
  hasLoaded: false,

  // Input settings state
  currentPrompt: '',
  currentModelSelections: {},
  currentAspectRatio: '1:1',
  currentResolution: '1K',
  currentReferenceImages: [],
  isGenerating: false,

  // Gallery actions
  loadImages: async () => {
    set({ isLoading: true });
    try {
      const storedImages = await getAllImages();
      // Map stored images to GalleryItems with status: 'completed'
      const items = storedImages.map((img) => ({
        id: img.id,
        status: 'completed' as const,
        modelId: img.modelId,
        modelName: img.modelName,
        prompt: img.prompt,
        aspectRatio: img.aspectRatio as AspectRatio,
        resolution: img.resolution as Resolution | null,
        referenceImageIds: img.referenceImageIds,
        blob: img.blob,
        url: URL.createObjectURL(img.blob),
        width: img.width,
        height: img.height,
        createdAt: img.createdAt,
        metadata: img.metadata,
      }));
      set({ items, hasLoaded: true });
    } catch (error) {
      console.error('Failed to load images:', error);
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
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  deleteItem: async (id) => {
    const state = get();
    const item = state.items.find((i) => i.id === id);

    try {
      await dbDeleteImage(id);
      if (item?.status === 'completed') {
        URL.revokeObjectURL(item.url);
      }
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        isLightboxOpen: state.selectedImageId === id ? false : state.isLightboxOpen,
        selectedImageId: state.selectedImageId === id ? null : state.selectedImageId,
      }));
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  },

  dismissItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),

  setViewMode: (viewMode) => set({ viewMode }),

  openLightbox: (imageId) =>
    set({
      selectedImageId: imageId,
      isLightboxOpen: true,
    }),

  closeLightbox: () =>
    set({
      isLightboxOpen: false,
    }),

  navigateLightbox: (direction) => {
    const state = get();
    if (!state.selectedImageId) return;

    const completedItems = state.items.filter((i) => i.status === 'completed');
    const currentIndex = completedItems.findIndex((i) => i.id === state.selectedImageId);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : completedItems.length - 1;
    } else {
      newIndex = currentIndex < completedItems.length - 1 ? currentIndex + 1 : 0;
    }

    set({ selectedImageId: completedItems[newIndex].id });
  },

  getSelectedItem: () => {
    const state = get();
    const item = state.items.find((i) => i.id === state.selectedImageId);
    if (item && item.status === 'completed') {
      return item;
    }
    return null;
  },

  getCompletedItems: () => {
    const state = get();
    return state.items.filter((i) => i.status === 'completed');
  },

  getItemsByDate: () => {
    const state = get();
    const grouped = new Map<string, CompletedGalleryItem[]>();
    const completedItems = state.items.filter((i) => i.status === 'completed');

    for (const item of completedItems) {
      if (!item.createdAt) continue;
      const key = formatDateKey(item.createdAt);
      const existing = grouped.get(key) || [];
      grouped.set(key, [...existing, item]);
    }

    return grouped;
  },

  // Input settings actions
  setPrompt: (prompt) => set({ currentPrompt: prompt }),

  setModelCount: (modelId, count) =>
    set((state) => ({
      currentModelSelections: {
        ...state.currentModelSelections,
        [modelId]: Math.max(0, count),
      },
    })),

  setAspectRatio: (aspectRatio) => set({ currentAspectRatio: aspectRatio }),

  setResolution: (resolution) => set({ currentResolution: resolution }),

  addReferenceImage: (image) =>
    set((state) => ({
      currentReferenceImages: [...state.currentReferenceImages, image],
    })),

  removeReferenceImage: (id) =>
    set((state) => {
      const image = state.currentReferenceImages.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.url);
      }
      return {
        currentReferenceImages: state.currentReferenceImages.filter((img) => img.id !== id),
      };
    }),

  clearReferenceImages: () =>
    set((state) => {
      state.currentReferenceImages.forEach((img) => URL.revokeObjectURL(img.url));
      return { currentReferenceImages: [] };
    }),

  setGenerating: (isGenerating) => set({ isGenerating }),

  getSelectedModelIds: () => {
    const state = get();
    return Object.entries(state.currentModelSelections)
      .filter(([, count]) => count > 0)
      .map(([modelId]) => modelId);
  },

  getTotalImageCount: () => {
    const state = get();
    return Object.values(state.currentModelSelections).reduce((sum, count) => sum + count, 0);
  },
}));
