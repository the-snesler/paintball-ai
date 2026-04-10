// Model types
export type Provider = "google" | "replicate";

export type AspectRatio = string;

export type Resolution = "1K" | "2K" | "4K";

export interface ModelCapabilities {
  supportsAspectRatios: boolean;
  supportedAspectRatios?: string[];
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
  schemaMapping?: SchemaMapping; // parameter translation for non-standard Replicate models
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

export interface LightboxGalleryTarget {
  kind: "gallery";
  imageId: string;
}

export interface LightboxReferenceTarget {
  kind: "reference";
  image: Pick<ReferenceImage, "id" | "url" | "name">;
}

export type LightboxTarget = LightboxGalleryTarget | LightboxReferenceTarget;

export interface GenerationRequest {
  prompt: string;
  modelSelections: Record<string, number>; // modelId -> count
  aspectRatio: AspectRatio | null;
  resolution: Resolution | null;
  referenceImages: ReferenceImage[];
}

// Unified gallery item that transitions through states
export interface BaseGalleryItem {
  id: string;
  modelId: string;
  modelName: string;
  prompt: string;
  /** Original template prompt (with {{...}} brackets) when variations were applied. Used to group siblings. */
  basePrompt?: string;
  /** Per-section replacements applied to basePrompt to produce prompt. Index aligns with
   *  sections parsed from basePrompt. Undefined for items generated before this field existed
   *  or when variations were not applied. */
  variationReplacements?: string[];
  aspectRatio: AspectRatio | null;
  resolution: Resolution | null;
  referenceImageIds: string[];
}

export interface PendingGalleryItemFields {
  status: "pending" | "generating" | "waiting";
  retryCount?: number;
  waitingUntil?: number; // Timestamp when rate limit expires
  retryAfter?: number; // Seconds to wait (for display)
}

export type PendingGalleryItem = BaseGalleryItem & PendingGalleryItemFields;

export interface CompletedGalleryItemFields {
  status: "completed";
  originalBlob: Blob;
  originalUrl: string; // Object URL for full-quality display/download
  thumbnailBlob: Blob;
  thumbnailUrl: string; // Object URL for gallery card display
  width: number;
  height: number;
  createdAt: number;
  generationTimeMs?: number;
  metadata: Record<string, unknown>; // Will include thinking traces for gemini 3 models
}

export type CompletedGalleryItem = BaseGalleryItem & CompletedGalleryItemFields;

export interface FailedGalleryItemFields {
  status: "failed";
  error: string;
  canRetry?: boolean; // Whether this failure can be retried
}

export type FailedGalleryItem = BaseGalleryItem & FailedGalleryItemFields;

export type GalleryItem = PendingGalleryItem | CompletedGalleryItem | FailedGalleryItem;

// Stored version without URL (URLs are created at runtime)
export interface StoredImageRecord {
  id: string;
  originalBlob: Blob;
  thumbnailBlob: Blob;
  prompt: string;
  basePrompt?: string;
  variationReplacements?: string[];
  modelId: string;
  modelName: string;
  aspectRatio: AspectRatio | null;
  resolution: Resolution | null;
  width: number;
  height: number;
  createdAt: number;
  generationTimeMs?: number;
  referenceImageIds: string[];
  metadata: Record<string, unknown>;
}

export type ViewMode = "grid" | "timeline";

export interface AttachSelectedItemsResult {
  success: boolean;
  attachedCount: number;
  maxAllowed: number | null;
  reason?: string;
}

// Text model types
export interface TextModelConfig {
  provider: Provider;
  modelId: string;
}

export interface SchemaMapping {
  resolution?: Record<string, string>;
  aspectRatioKey?: string;
  imageInputKey?: string;
  maxReferenceImages?: number;
  extraDefaults?: Record<string, unknown>;
}

// Settings types
export interface ApiKeys {
  google: string | null;
  replicate: string | null;
}

// Editor types
export interface EditorTurn {
  id: string;
  instruction: string;
  /** Gallery item ID used as reference (null = original source image) */
  sourceItemId: string | null;
  /** Snapshot of reference blob at time of edit */
  sourceBlob: Blob;
  /** Gallery item IDs for all generated results in this turn */
  itemIds: string[];
  createdAt: number;
  /** AI-generated summary of editing lineage intent (style, character, constraints) */
  contextBrief?: string;
}
