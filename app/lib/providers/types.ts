import type { GenerationParams, GenerationResult } from "~/lib/generation";
import type {
  ApiKeyProvider,
  AspectRatio,
  ModelCapabilities,
  Provider as ProviderId,
  Resolution,
  SchemaMapping,
  StoredModel,
  StoredUpscaler,
} from "~/types";

export interface CostEstimateArgs {
  model: StoredModel;
  aspectRatio: AspectRatio | null;
  resolution: Resolution | null;
  quality: string | null;
  numberOfImages: number;
  /** Known output dimensions when available (e.g., backfilling a completed image). */
  width?: number;
  height?: number;
}

export interface CostEstimate {
  /** Total cost in USD for all `numberOfImages` images. */
  totalUsd: number;
  /** Per-image cost in USD. */
  perImageUsd: number;
}

export interface ProviderCapabilities {
  image: boolean;
  text: boolean;
  upscale: boolean;
  searchImage: boolean;
  searchText: boolean;
  searchUpscale: boolean;
}

export interface SearchResult {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  icon?: string;
}

export interface ResolvedImageModel {
  name: string;
  capabilities: ModelCapabilities;
  schemaMapping?: SchemaMapping;
  icon?: string;
}

export interface TextGenerationArgs {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  images?: Blob[];
  prefill?: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  iconPath: string;
  requiresApiKey: boolean;
  capabilities: ProviderCapabilities;
  supportsTextPrefill?: boolean;

  generateImage?(params: GenerationParams, apiKey?: string): Promise<GenerationResult[]>;
  generateText?(args: TextGenerationArgs, apiKey: string): Promise<string>;
  testTextModel?(apiKey: string, modelId: string): Promise<void>;
  upscale?(sourceBlob: Blob, upscaler: StoredUpscaler, apiKey: string): Promise<GenerationResult>;

  searchImageModels?(query: string, apiKey: string): Promise<SearchResult[]>;
  searchTextModels?(query: string, apiKey: string): Promise<SearchResult[]>;
  searchUpscalers?(query: string, apiKey: string): Promise<SearchResult[]>;

  resolveImageModel(
    modelId: string,
    apiKey: string,
    onProgress?: (status: string) => void
  ): Promise<ResolvedImageModel>;

  /** Returns USD cost estimate for the request, or null when pricing is unknown. */
  estimateCost?(args: CostEstimateArgs): CostEstimate | null;
}

export type TextCapableProvider = Provider & {
  id: ApiKeyProvider;
  generateText: NonNullable<Provider["generateText"]>;
  testTextModel: NonNullable<Provider["testTextModel"]>;
};
