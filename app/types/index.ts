// Model types
export type Provider = 'google' | 'openai' | 'replicate';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9';

export type Resolution = '1K' | '2K' | '4K';

export interface ModelCapabilities {
  aspectRatios: AspectRatio[];
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

export interface PendingGeneration {
  id: string;
  modelId: string;
  modelName: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
}

// Gallery types
export interface ImageRecord {
  id: string;
  blob: Blob;
  url: string; // Object URL for display
  prompt: string;
  modelId: string;
  modelName: string;
  aspectRatio: string;
  resolution: string | null;
  width: number;
  height: number;
  createdAt: number;
  referenceImageIds: string[];
  metadata: Record<string, unknown>;
}

// Stored version without URL (URLs are created at runtime)
export interface StoredImageRecord {
  id: string;
  blob: Blob;
  prompt: string;
  modelId: string;
  modelName: string;
  aspectRatio: string;
  resolution: string | null;
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
  openai: string | null;
  replicate: string | null;
}
