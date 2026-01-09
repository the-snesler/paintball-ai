import { create } from 'zustand';
import type { ImageRecord, ViewMode } from '~/types';
import { getAllImages, deleteImage as dbDeleteImage, toDisplayImage } from '~/lib/db';

interface GalleryState {
  images: ImageRecord[];
  viewMode: ViewMode;
  selectedImageId: string | null;
  isLightboxOpen: boolean;
  isLoading: boolean;
  hasLoaded: boolean;

  loadImages: () => Promise<void>;
  addImage: (image: ImageRecord) => void;
  deleteImage: (id: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  openLightbox: (imageId: string) => void;
  closeLightbox: () => void;
  navigateLightbox: (direction: 'prev' | 'next') => void;
  getSelectedImage: () => ImageRecord | null;
  getImagesByDate: () => Map<string, ImageRecord[]>;
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
  images: [],
  viewMode: 'grid',
  selectedImageId: null,
  isLightboxOpen: false,
  isLoading: false,
  hasLoaded: false,

  loadImages: async () => {
    set({ isLoading: true });
    try {
      const storedImages = await getAllImages();
      const images = storedImages.map(toDisplayImage);
      set({ images, hasLoaded: true });
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addImage: (image) =>
    set((state) => ({
      images: [image, ...state.images],
    })),

  deleteImage: async (id) => {
    const state = get();
    const image = state.images.find((img) => img.id === id);

    try {
      await dbDeleteImage(id);
      if (image) {
        URL.revokeObjectURL(image.url);
      }
      set((state) => ({
        images: state.images.filter((img) => img.id !== id),
        isLightboxOpen: state.selectedImageId === id ? false : state.isLightboxOpen,
        selectedImageId: state.selectedImageId === id ? null : state.selectedImageId,
      }));
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  },

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

    const currentIndex = state.images.findIndex((img) => img.id === state.selectedImageId);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : state.images.length - 1;
    } else {
      newIndex = currentIndex < state.images.length - 1 ? currentIndex + 1 : 0;
    }

    set({ selectedImageId: state.images[newIndex].id });
  },

  getSelectedImage: () => {
    const state = get();
    return state.images.find((img) => img.id === state.selectedImageId) || null;
  },

  getImagesByDate: () => {
    const state = get();
    const grouped = new Map<string, ImageRecord[]>();

    for (const image of state.images) {
      const key = formatDateKey(image.createdAt);
      const existing = grouped.get(key) || [];
      grouped.set(key, [...existing, image]);
    }

    return grouped;
  },
}));
