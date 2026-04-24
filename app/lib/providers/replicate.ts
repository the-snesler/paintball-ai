import { distance } from "fastest-levenshtein";
import Replicate from "replicate";
import type { GenerationParams, GenerationResult } from "~/lib/generation";
import { getImageDimensions } from "~/lib/imageProcessing";
import { inferIcon, inferName } from "~/lib/modelNames";
import { dereferenceProperties, type OpenApiSchemaProperty } from "~/lib/openapi";
import { SCHEMA_MAPPING_SYSTEM } from "~/lib/prompts";
import { toRateLimitError } from "~/lib/retry";
import { callTextModel } from "~/lib/textModel";
import { useSettingsStore } from "~/stores/settingsStore";
import { blobToBase64 } from "~/lib/util";
import type { ModelCapabilities, SchemaMapping, StoredUpscaler } from "~/types";
import type { Provider, ResolvedImageModel, SearchResult, TextGenerationArgs } from "./types";

function replicateBaseUrl(): string {
  return new URL("/proxy/replicate/v1", window.location.origin).toString();
}

async function generateImage(params: GenerationParams, apiKey?: string): Promise<GenerationResult> {
  if (!apiKey) throw new Error("No API key for replicate");
  const replicate = new Replicate({ auth: apiKey, baseUrl: replicateBaseUrl() });

  const imageInputs = await Promise.all(
    params.referenceImages.map(async (ref) => blobToBase64(ref.blob))
  );

  const model = useSettingsStore.getState().models.find((m) => m.id === params.modelId);
  const mapping = model?.schemaMapping;

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    output_format: "png",
  };
  if (params.aspectRatio) {
    const aspectRatioKey = mapping?.aspectRatioKey ?? "aspect_ratio";
    input[aspectRatioKey] = params.aspectRatio;
  }
  if (imageInputs.length > 0) {
    const imageKey = mapping?.imageInputKey ?? "image_input";
    input[imageKey] = imageInputs;
  }
  if (params.resolution) {
    input.resolution = mapping?.resolution?.[params.resolution] ?? params.resolution;
  }
  if (mapping?.extraDefaults) {
    for (const [key, value] of Object.entries(mapping.extraDefaults)) {
      if (!(key in input)) input[key] = value;
    }
  }

  const replicateModel = params.modelId.replace("replicate/", "") as `${string}/${string}`;

  let output;
  try {
    output = await replicate.run(replicateModel, { input });
  } catch (error) {
    throw toRateLimitError(error, "replicate");
  }

  const imageUrl =
    typeof output === "object" && output !== null && "url" in output
      ? (output as { url: () => string }).url()
      : Array.isArray(output)
        ? output[0]
        : String(output);

  if (!imageUrl) throw new Error("No image in Replicate response");

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok)
    throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);

  const blob = await imageResponse.blob();
  const dimensions = await getImageDimensions(blob);

  return { blob, width: dimensions.width, height: dimensions.height, metadata: {} };
}

async function generateText(args: TextGenerationArgs, apiKey: string): Promise<string> {
  const replicate = new Replicate({ auth: apiKey, baseUrl: replicateBaseUrl() });
  let { systemPrompt, userPrompt } = args;
  const { modelId, images, prefill } = args;

  // Replicate doesn't support prefills, so we just concatenate it to the user prompt.
  if (prefill) {
    userPrompt = prefill + "\n" + userPrompt;
  }

  let output;
  try {
    output = await replicate.run(modelId as `${string}/${string}`, {
      input: { prompt: userPrompt, system_instruction: systemPrompt, images },
    });
  } catch (error) {
    throw toRateLimitError(error, "replicate");
  }

  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    return output.join("");
  }

  throw new Error("Unexpected text model response format");
}

async function testTextModel(apiKey: string, modelId: string): Promise<void> {
  await generateText(
    {
      modelId,
      systemPrompt: "You are a connectivity test.",
      userPrompt: "Respond with the single word 'hi' and nothing else.",
    },
    apiKey
  );
}

async function upscale(
  sourceBlob: Blob,
  upscaler: StoredUpscaler,
  apiKey: string
): Promise<GenerationResult> {
  const replicate = new Replicate({ auth: apiKey, baseUrl: replicateBaseUrl() });
  const dataUri = await blobToBase64(sourceBlob);

  const input: Record<string, unknown> = { image: dataUri };
  if (upscaler.scaleParam !== null && upscaler.scale !== null) {
    input[upscaler.scaleParam] = upscaler.scale;
  }

  const output = await replicate.run(upscaler.replicateId as `${string}/${string}`, { input });

  const imageUrl =
    typeof output === "object" && output !== null && "url" in output
      ? (output as { url: () => string }).url()
      : Array.isArray(output)
        ? output[0]
        : String(output);

  if (!imageUrl) throw new Error("No image in upscale response");

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Failed to fetch upscaled image: ${imageResponse.status}`);

  const blob = await imageResponse.blob();
  const dimensions = await getImageDimensions(blob);

  return { blob, width: dimensions.width, height: dimensions.height, metadata: {} };
}

interface ReplicateSearchResponse {
  results: Array<{
    owner: string;
    name: string;
    description?: string;
    cover_image_url?: string;
    latest_version?: {
      openapi_schema?: {
        components?: {
          schemas?: any;
        };
      };
    };
  }>;
}

async function searchModels(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch("/proxy/replicate/v1/models", {
    method: "QUERY",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "text/plain",
    },
    body: query,
  });

  if (!response.ok) return [];

  const data: ReplicateSearchResponse = await response.json();

  const imageModels = data.results.filter((r) => {
    const outputSchema = r.latest_version?.openapi_schema?.components?.schemas?.Output;
    return outputSchema?.items?.format === "uri" || outputSchema?.format === "uri";
  });

  imageModels.sort((a, b) => {
    return distance(query, `${a.owner}/${a.name}`) - distance(query, `${b.owner}/${b.name}`);
  });

  return imageModels.slice(0, 6).map((r) => {
    const id = `${r.owner}/${r.name}`;
    return {
      id,
      name: inferName(id),
      description: r.description,
      coverImageUrl: r.cover_image_url,
      icon: inferIcon(id),
    };
  });
}

interface ReplicateModelResponse {
  name: string;
  description?: string;
  latest_version?: {
    openapi_schema?: {
      components?: {
        schemas?: Record<string, OpenApiSchemaProperty>;
      };
    };
  };
}

interface HeuristicResult {
  capabilities: ModelCapabilities;
  detectedAspectRatioKey?: string;
}

interface SchemaAnalysis {
  mapping: SchemaMapping;
  supportedAspectRatios?: string[];
}

async function fetchReplicateModelSchema(
  modelId: string,
  apiKey: string
): Promise<{ properties: Record<string, OpenApiSchemaProperty> }> {
  const response = await fetch(`/proxy/replicate/v1/models/${modelId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Model not found: ${modelId}`);
  }

  const data: ReplicateModelResponse = await response.json();
  const allSchemas = data.latest_version?.openapi_schema?.components?.schemas ?? {};
  const inputSchema = allSchemas["Input"] as
    | { properties?: Record<string, OpenApiSchemaProperty> }
    | undefined;
  const rawProperties = inputSchema?.properties ?? {};
  const properties = dereferenceProperties(rawProperties, allSchemas);

  return { properties };
}

function inferCapabilitiesFromProperties(
  properties: Record<string, OpenApiSchemaProperty>
): HeuristicResult {
  const aspectRatioKeys = ["aspect_ratio", "aspectRatio", "output_aspect_ratio"];
  const detectedAspectRatioKey = aspectRatioKeys.find((key) => properties[key]);
  const supportsAspectRatios = !!detectedAspectRatioKey;

  const supportsResolution = !!(
    properties.resolution ||
    properties.megapixels ||
    properties.output_resolution
  );

  const imageProps = [
    "image",
    "image_input",
    "input_image",
    "input_images",
    "reference_image",
    "init_image",
    "control_image",
  ];
  const imageProperty = imageProps.find((prop) => properties[prop]);
  const supportsReferenceImages = !!imageProperty;

  let maxReferenceImages = 1;
  if (imageProperty && properties[imageProperty].type === "array") {
    maxReferenceImages = 10;
  }

  return {
    capabilities: {
      supportsAspectRatios,
      supportsResolution,
      supportsReferenceImages,
      maxReferenceImages,
    },
    detectedAspectRatioKey,
  };
}

async function analyzeSchemaWithTextModel(
  properties: Record<string, OpenApiSchemaProperty>
): Promise<SchemaAnalysis | null> {
  try {
    const response = await callTextModel(SCHEMA_MAPPING_SYSTEM, JSON.stringify(properties));

    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
    const jsonStr = (jsonMatch[1] ?? response).trim();
    const parsed = JSON.parse(jsonStr);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const mapping: SchemaMapping = {};
    let supportedAspectRatios: string[] | undefined;

    if (parsed.resolution && typeof parsed.resolution === "object") {
      mapping.resolution = parsed.resolution;
    }
    if (typeof parsed.aspectRatioKey === "string" && parsed.aspectRatioKey !== "aspect_ratio") {
      mapping.aspectRatioKey = parsed.aspectRatioKey;
    }
    if (typeof parsed.imageInputKey === "string" && parsed.imageInputKey !== "image_input") {
      mapping.imageInputKey = parsed.imageInputKey;
    }
    if (typeof parsed.maxReferenceImages === "number" && parsed.maxReferenceImages > 0) {
      mapping.maxReferenceImages = parsed.maxReferenceImages;
    }
    if (parsed.extraDefaults && typeof parsed.extraDefaults === "object") {
      mapping.extraDefaults = parsed.extraDefaults;
    }
    if (Array.isArray(parsed.supportedAspectRatios)) {
      supportedAspectRatios = parsed.supportedAspectRatios.filter(
        (v: unknown): v is string => typeof v === "string"
      );
    }

    const hasMapping = Object.keys(mapping).length > 0;
    if (!hasMapping && !supportedAspectRatios) {
      return null;
    }

    return { mapping, supportedAspectRatios };
  } catch {
    return null;
  }
}

function mergeAnalysis(
  heuristic: HeuristicResult,
  analysis: SchemaAnalysis | null,
  properties: Record<string, OpenApiSchemaProperty>
): { capabilities: ModelCapabilities; schemaMapping: SchemaMapping | undefined } {
  const capabilities: ModelCapabilities = { ...heuristic.capabilities };
  const mapping: SchemaMapping = { ...(analysis?.mapping ?? {}) };

  if (analysis?.supportedAspectRatios !== undefined) {
    capabilities.supportedAspectRatios = analysis.supportedAspectRatios;
  }

  if (
    heuristic.detectedAspectRatioKey &&
    heuristic.detectedAspectRatioKey !== "aspect_ratio" &&
    !mapping.aspectRatioKey
  ) {
    mapping.aspectRatioKey = heuristic.detectedAspectRatioKey;
  }

  if (mapping.imageInputKey && !capabilities.supportsReferenceImages) {
    capabilities.supportsReferenceImages = true;
    capabilities.maxReferenceImages =
      mapping.maxReferenceImages ?? (properties[mapping.imageInputKey]?.type === "array" ? 10 : 1);
  } else if (mapping.maxReferenceImages) {
    capabilities.maxReferenceImages = mapping.maxReferenceImages;
  }

  if (mapping.resolution && !capabilities.supportsResolution) {
    capabilities.supportsResolution = true;
  }

  const schemaMapping = Object.keys(mapping).length > 0 ? mapping : undefined;
  return { capabilities, schemaMapping };
}

async function resolveImageModel(
  modelId: string,
  apiKey: string,
  onProgress?: (status: string) => void
): Promise<ResolvedImageModel> {
  onProgress?.("Fetching schema...");
  const { properties } = await fetchReplicateModelSchema(modelId, apiKey);
  const heuristic = inferCapabilitiesFromProperties(properties);

  onProgress?.("Analyzing parameters...");
  const analysis = await analyzeSchemaWithTextModel(properties);

  const { capabilities, schemaMapping } = mergeAnalysis(heuristic, analysis, properties);
  return { name: inferName(modelId), capabilities, schemaMapping, icon: inferIcon(modelId) };
}

export const replicateProvider: Provider = {
  id: "replicate",
  label: "Replicate",
  iconPath: "/icons/replicate.svg",
  requiresApiKey: true,
  supportsTextPrefill: false,
  capabilities: {
    image: true,
    text: true,
    upscale: true,
    searchImage: true,
    searchText: false,
    searchUpscale: true,
    resolveImageModel: true,
  },
  generateImage,
  generateText,
  testTextModel,
  upscale,
  searchImageModels: searchModels,
  searchUpscalers: searchModels,
  resolveImageModel,
};
