import { dereferenceProperties, type OpenApiSchemaProperty } from "~/lib/openapi";
import { SCHEMA_MAPPING_SYSTEM } from "~/lib/prompts";
import { callTextModel } from "~/lib/textModel";
import type { ModelCapabilities, SchemaMapping } from "~/types";

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

/**
 * Full model resolution: fetch schema, run LLM analysis, reconcile capabilities.
 * Returns everything needed to add a custom model in one call.
 */
export async function resolveModelCapabilities(
  modelId: string,
  apiKey: string,
  onProgress?: (status: string) => void
): Promise<{
  name: string;
  capabilities: ModelCapabilities;
  schemaMapping: SchemaMapping | undefined;
  icon: string | undefined;
}> {
  onProgress?.("Fetching schema...");
  const { properties } = await fetchReplicateModelSchema(modelId, apiKey);
  const heuristic = inferCapabilitiesFromProperties(properties);

  onProgress?.("Analyzing parameters...");
  const analysis = await analyzeSchemaWithTextModel(properties);

  const { capabilities, schemaMapping } = mergeAnalysis(heuristic, analysis, properties);
  return { name: inferName(modelId), capabilities, schemaMapping, icon: inferIcon(modelId) };
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

/**
 * Heuristic capability detection from dereferenced schema properties.
 */
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

/**
 * Ask the text model to produce parameter mappings and enumerate supported aspect ratios.
 * Returns null if the text model is unavailable, response can't be parsed, or nothing useful was found.
 */
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

/**
 * Merge heuristic and LLM analyses into final capabilities + schemaMapping.
 * LLM findings are authoritative; heuristic fills gaps.
 */
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

const ICON_PATTERNS: [RegExp, string][] = [
  [/^openai\/|gpt/i, "/icons/openai.svg"],
  [/^black-forest-labs\/|flux/i, "/icons/bfl.svg"],
  [/^google\/|gemini/i, "/icons/google.svg"],
  [/^bytedance\/|seedream/i, "/icons/bytedance.svg"],
];

function inferIcon(modelId: string): string | undefined {
  for (const [pattern, icon] of ICON_PATTERNS) {
    if (pattern.test(modelId)) {
      return icon;
    }
  }
  return undefined;
}

// things that should have more than just title-casing and symbol replacement in the name
const NAME_PATTERNS: [RegExp, string][] = [
  [/gpt/i, "GPT"],
  [/svg/i, "SVG"],
]

/**
 * Converts "owner/model-name" to "Model Name", with some special cases for common patterns.
 */
function inferName(modelId: string): string {
  let rawName = modelId.split("/").pop() || modelId;
  for (const [pattern, replacement] of NAME_PATTERNS) {
    rawName = rawName.replace(pattern, replacement);
  }
  rawName = rawName.replace(/[-_]/g, " ") // Replace dashes and underscores with spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // Title-case each word
  return rawName;
}
