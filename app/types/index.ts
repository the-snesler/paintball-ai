// Model types
export type Provider = 'google' | 'replicate';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9';

export type Resolution = '1K' | '2K' | '4K';

export interface ModelCapabilities {
  supportsAspectRatios: boolean;
  supportsResolution: boolean;
  resolutions?: Resolution[];
  supportsReferenceImages: boolean;
  maxReferenceImages: number;
}

export interface ModelDefinition {
  id: string;
  name: string;
  provider: Provider;
  apiKeyRequired: Provider;
  capabilities: ModelCapabilities;
  defaultAspectRatio: AspectRatio;
  maxImagesPerRequest: number;
  icon?: string;
}

// Model stored in settings (user-configurable)
export interface StoredModel {
  id: string;
  name: string;
  provider: Provider;
  enabled: boolean;
  isCustom?: boolean; // true for user-added models
  schemaFetched?: boolean; // true if capabilities were fetched from Replicate API
  capabilities: ModelCapabilities;
  icon?: string; // Path to custom icon SVG (e.g., "/icons/google.svg")
}

// Generation types
export interface ReferenceImage {
  id: string;
  blob: Blob;
  url: string; // Object URL for display
  name: string;
}

export interface GenerationRequest {
  prompt: string;
  modelSelections: Record<string, number>; // modelId -> count
  aspectRatio: AspectRatio;
  resolution: Resolution | null;
  referenceImages: ReferenceImage[];
}

// Unified gallery item that transitions through states
export interface BaseGalleryItem {
  id: string;
  modelId: string;
  modelName: string;
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: Resolution | null;
  referenceImageIds: string[];
}

export interface PendingGalleryItemFields {
  status: 'pending' | 'generating' | 'waiting';
  retryCount?: number;
  waitingUntil?: number; // Timestamp when rate limit expires
  retryAfter?: number; // Seconds to wait (for display)
}

export type PendingGalleryItem = BaseGalleryItem & PendingGalleryItemFields;

export interface CompletedGalleryItemFields {
  status: 'completed';
  blob: Blob;
  url: string; // Object URL for display
  width: number;
  height: number;
  createdAt: number;
  metadata: Record<string, unknown>; // Will include thinking traces for gemini 3 models
}

export type CompletedGalleryItem = BaseGalleryItem & CompletedGalleryItemFields;

export interface FailedGalleryItemFields {
  status: 'failed';
  error: string;
  canRetry?: boolean; // Whether this failure can be retried
}

export type FailedGalleryItem = BaseGalleryItem & FailedGalleryItemFields;

export type GalleryItem = PendingGalleryItem | CompletedGalleryItem | FailedGalleryItem;

// Stored version without URL (URLs are created at runtime)
export interface StoredImageRecord {
  id: string;
  blob: Blob;
  prompt: string;
  modelId: string;
  modelName: string;
  aspectRatio: AspectRatio;
  resolution: Resolution | null;
  width: number;
  height: number;
  createdAt: number;
  referenceImageIds: string[];
  metadata: Record<string, unknown>;
}

export type ViewMode = 'grid' | 'timeline';

// Settings types
export interface ApiKeys {
  google: string | null;
  replicate: string | null;
}
