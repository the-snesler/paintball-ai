import { create } from 'zustand';
import type { GalleryItem, ViewMode, AspectRatio, Resolution, ReferenceImage, CompletedGalleryItem, CompletedGalleryItemFields, FailedGalleryItemFields, PendingGalleryItemFields, AttachSelectedItemsResult } from '~/types';
import { getAllImages, deleteImage as dbDeleteImage, toDisplayImage } from '~/lib/db';
import { canAttachReferenceCount } from '~/lib/models';
import { useSettingsStore } from './settingsStore';

interface GalleryState {
  // Gallery items (unified pending + completed)
  items: GalleryItem[];
  viewMode: ViewMode;
  selectedImageId: string | null;
  selectedItemIds: string[];
  isLightboxOpen: boolean;
  isLoading: boolean;
  hasLoaded: boolean;

  // Current input settings (for UI controls)
  currentPrompt: string;
  currentModelSelections: Record<string, number>;
  currentAspectRatio: AspectRatio | null;
  currentResolution: Resolution;
  currentReferenceImages: ReferenceImage[];
  activeGenerationCount: number;
  activeGenerationSignatures: Record<string, number>;
  lastSubmittedSignature: string | null;
  isGenerating: boolean;

  // Gallery actions
  loadImages: () => Promise<void>;
  addItem: (item: GalleryItem) => void;
  addItems: (items: GalleryItem[]) => void;
  updateItem: (id: string, updates: PendingGalleryItemFields | CompletedGalleryItemFields | FailedGalleryItemFields) => void;
  deleteItem: (id: string) => Promise<void>;
  dismissItem: (id: string) => void;
  getItem: (id: string) => GalleryItem | undefined;
  setViewMode: (mode: ViewMode) => void;
  openLightbox: (imageId: string) => void;
  closeLightbox: () => void;
  navigateLightbox: (direction: 'prev' | 'next') => void;
  getSelectedItem: () => CompletedGalleryItem | null;
  getCompletedItems: () => CompletedGalleryItem[];
  getItemsByDate: () => Map<string, CompletedGalleryItem[]>;
  toggleItemSelection: (id: string) => void;
  clearSelection: () => void;
  deleteSelectedItems: () => Promise<number>;
  downloadSelectedItems: () => number;
  attachSelectedItemsToPrompt: () => AttachSelectedItemsResult;

  // Input settings actions
  setPrompt: (prompt: string) => void;
  setModelCount: (modelId: string, count: number) => void;
  setAspectRatio: (ratio: AspectRatio | null) => void;
  setResolution: (resolution: Resolution) => void;
  addReferenceImage: (image: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;
  startGeneration: (signature: string) => void;
  finishGeneration: (signature: string) => void;
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
  selectedItemIds: [],
  isLightboxOpen: false,
  isLoading: false,
  hasLoaded: false,

  // Input settings state
  currentPrompt: '',
  currentModelSelections: {},
  currentAspectRatio: null,
  currentResolution: '1K',
  currentReferenceImages: [],
  activeGenerationCount: 0,
  activeGenerationSignatures: {},
  lastSubmittedSignature: null,
  isGenerating: false,

  // Gallery actions
  loadImages: async () => {
    set({ isLoading: true });
    try {
      const storedImages = await getAllImages();
      const items = storedImages.map((img) => toDisplayImage(img));
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
        URL.revokeObjectURL(item.originalUrl);
        URL.revokeObjectURL(item.thumbnailUrl);
      }
      set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        isLightboxOpen: state.selectedImageId === id ? false : state.isLightboxOpen,
        selectedImageId: state.selectedImageId === id ? null : state.selectedImageId,
        selectedItemIds: state.selectedItemIds.filter((selectedId) => selectedId !== id),
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

  getItem: (id) => get().items.find((i) => i.id === id),

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

  toggleItemSelection: (id) =>
    set((state) => {
      const item = state.items.find((entry) => entry.id === id);
      if (!item || item.status !== 'completed') {
        return state;
      }

      const isSelected = state.selectedItemIds.includes(id);
      return {
        selectedItemIds: isSelected
          ? state.selectedItemIds.filter((selectedId) => selectedId !== id)
          : [...state.selectedItemIds, id],
      };
    }),

  clearSelection: () => set({ selectedItemIds: [] }),

  deleteSelectedItems: async () => {
    const state = get();
    const selectedSet = new Set(state.selectedItemIds);
    const selectedItems = state.items.filter(
      (item): item is CompletedGalleryItem => item.status === 'completed' && selectedSet.has(item.id)
    );

    if (selectedItems.length === 0) {
      return 0;
    }

    await Promise.all(selectedItems.map((item) => dbDeleteImage(item.id)));
    selectedItems.forEach((item) => {
      URL.revokeObjectURL(item.originalUrl);
      URL.revokeObjectURL(item.thumbnailUrl);
    });

    const selectedImageId = get().selectedImageId;

    set((currentState) => ({
      items: currentState.items.filter((item) => !selectedSet.has(item.id)),
      selectedItemIds: [],
      isLightboxOpen:
        selectedImageId && selectedSet.has(selectedImageId)
          ? false
          : currentState.isLightboxOpen,
      selectedImageId:
        selectedImageId && selectedSet.has(selectedImageId)
          ? null
          : currentState.selectedImageId,
    }));

    return selectedItems.length;
  },

  downloadSelectedItems: () => {
    const state = get();
    const selectedSet = new Set(state.selectedItemIds);
    const selectedItems = state.items.filter(
      (item): item is CompletedGalleryItem => item.status === 'completed' && selectedSet.has(item.id)
    );

    selectedItems.forEach((item, index) => {
      const extension = getBlobExtension(item.originalBlob);
      const link = document.createElement('a');
      link.href = item.originalUrl;
      link.download = `${sanitizeFilename(item.modelName)}-${item.createdAt}-${index + 1}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    return selectedItems.length;
  },

  attachSelectedItemsToPrompt: () => {
    const state = get();
    const selectedSet = new Set(state.selectedItemIds);
    const selectedItems = state.items.filter(
      (item): item is CompletedGalleryItem => item.status === 'completed' && selectedSet.has(item.id)
    );

    if (selectedItems.length === 0) {
      return {
        success: false,
        attachedCount: 0,
        maxAllowed: null,
        reason: 'No images selected.',
      } satisfies AttachSelectedItemsResult;
    }

    const settingsState = useSettingsStore.getState();
    const selectedModelIds = Object.entries(state.currentModelSelections)
      .filter(([, count]) => count > 0)
      .map(([modelId]) => modelId);

    const totalReferences = state.currentReferenceImages.length + selectedItems.length;
    const fit = canAttachReferenceCount(settingsState.models, selectedModelIds, totalReferences);

    if (!fit.allowed) {
      return {
        success: false,
        attachedCount: 0,
        maxAllowed: fit.maxAllowed,
        reason:
          fit.maxAllowed === null
            ? 'One or more selected models do not support reference images.'
            : `Selected images exceed the current model limit (${fit.maxAllowed} max).`,
      } satisfies AttachSelectedItemsResult;
    }

    const newReferences: ReferenceImage[] = selectedItems.map((item) => ({
      id: crypto.randomUUID(),
      blob: item.originalBlob,
      url: URL.createObjectURL(item.originalBlob),
      name: `${item.modelName} - ${item.prompt.slice(0, 40).trim() || 'Image'}`,
    }));

    set((currentState) => ({
      currentReferenceImages: [...currentState.currentReferenceImages, ...newReferences],
      selectedItemIds: [],
    }));

    return {
      success: true,
      attachedCount: newReferences.length,
      maxAllowed: fit.maxAllowed,
    } satisfies AttachSelectedItemsResult;
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

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'image';
}

function getBlobExtension(blob: Blob): string {
  const type = blob.type.toLowerCase();

  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  return 'png';
}
