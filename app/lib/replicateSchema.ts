import { SCHEMA_MAPPING_SYSTEM } from "~/lib/prompts";
import { callTextModel } from "~/lib/textModel";
import type { ModelCapabilities, SchemaMapping } from "~/types";

interface SchemaMappingWithRatios extends SchemaMapping {
  supportedAspectRatios?: string[];
}

interface SchemaProperty {
  type: string;
  enum?: string[];
  items?: { type: string; format?: string };
  default?: unknown;
  description?: string;
}

interface ReplicateModelResponse {
  name: string;
  description?: string;
  latest_version?: {
    openapi_schema?: {
      components?: {
        schemas?: {
          Input?: {
            properties?: Record<string, SchemaProperty>;
          };
        };
      };
    };
  };
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
  const { name, capabilities, rawProperties, detectedAspectRatioKey } = await fetchModelRaw(
    modelId,
    apiKey
  );
  const icon = inferIcon(modelId);

  onProgress?.("Analyzing parameters...");
  const llmResult = (await generateSchemaMapping(rawProperties)) ?? undefined;

  // Separate supportedAspectRatios (goes into capabilities) from the rest (schemaMapping)
  let supportedAspectRatios: string[] | undefined;
  let schemaMapping: SchemaMapping | undefined;

  if (llmResult) {
    const { supportedAspectRatios: llmRatios, ...rest } = llmResult;
    supportedAspectRatios = llmRatios;
    schemaMapping = Object.keys(rest).length > 0 ? rest : undefined;
  }

  // If heuristic detected a non-standard aspect ratio key and LLM didn't, include it
  if (detectedAspectRatioKey && detectedAspectRatioKey !== "aspect_ratio") {
    if (!schemaMapping?.aspectRatioKey) {
      schemaMapping = { ...(schemaMapping ?? {}), aspectRatioKey: detectedAspectRatioKey };
    }
  }

  // Reconcile: LLM findings are authoritative over heuristic parseCapabilities
  if (supportedAspectRatios && supportedAspectRatios.length > 0) {
    capabilities.supportedAspectRatios = supportedAspectRatios;
  }

  if (schemaMapping) {
    if (schemaMapping.imageInputKey && !capabilities.supportsReferenceImages) {
      capabilities.supportsReferenceImages = true;
      capabilities.maxReferenceImages =
        schemaMapping.maxReferenceImages ??
        (rawProperties[schemaMapping.imageInputKey]?.type === "array" ? 10 : 1);
    } else if (schemaMapping.maxReferenceImages) {
      capabilities.maxReferenceImages = schemaMapping.maxReferenceImages;
    }
    if (schemaMapping.resolution && !capabilities.supportsResolution) {
      capabilities.supportsResolution = true;
    }
  }

  return { name, capabilities, schemaMapping, icon };
}

async function fetchModelRaw(
  modelId: string,
  apiKey: string
): Promise<{
  name: string;
  capabilities: ModelCapabilities;
  rawProperties: Record<string, SchemaProperty>;
  detectedAspectRatioKey?: string;
}> {
  const response = await fetch(`/proxy/replicate/v1/models/${modelId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Model not found: ${modelId}`);
  }

  const data: ReplicateModelResponse = await response.json();
  const schema = data.latest_version?.openapi_schema?.components?.schemas?.Input;
  const properties = schema?.properties || {};

  const { capabilities, detectedAspectRatioKey } = parseCapabilities(properties);
  const name = data.name || modelId.split("/").pop() || modelId;

  return { name, capabilities, rawProperties: properties, detectedAspectRatioKey };
}

/**
 * Parse schema properties into our ModelCapabilities format
 */
function parseCapabilities(properties: Record<string, SchemaProperty>): {
  capabilities: ModelCapabilities;
  detectedAspectRatioKey?: string;
} {
  const aspectRatioKeys = ["aspect_ratio", "aspectRatio", "output_aspect_ratio"];
  const detectedAspectRatioKey = aspectRatioKeys.find((key) => properties[key]);
  const supportsAspectRatios = !!detectedAspectRatioKey;

  // Check for resolution/megapixels support
  const supportsResolution = !!(
    properties.resolution ||
    properties.megapixels ||
    properties.output_resolution
  );

  // Check for reference image support - various property names used
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

  // Infer max reference images
  let maxReferenceImages = 1;
  if (imageProperty) {
    const prop = properties[imageProperty];
    // If it's an array type, allow multiple
    if (prop.type === "array") {
      maxReferenceImages = 10; // Default max for array inputs
    }
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
 * Use text model to generate parameter mappings from a raw Replicate schema.
 * Returns null if the text model is unavailable or response can't be parsed.
 */
async function generateSchemaMapping(
  rawProperties: Record<string, SchemaProperty>
): Promise<SchemaMappingWithRatios | null> {
  try {
    const response = await callTextModel(SCHEMA_MAPPING_SYSTEM, JSON.stringify(rawProperties));

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
    const jsonStr = (jsonMatch[1] ?? response).trim();
    const parsed = JSON.parse(jsonStr);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    // Validate and build a clean SchemaMapping + extracted aspect ratios
    const mapping: SchemaMappingWithRatios = {};

    if (parsed.resolution && typeof parsed.resolution === "object") {
      mapping.resolution = parsed.resolution;
    }

    if (typeof parsed.aspectRatioKey === "string" && parsed.aspectRatioKey !== "aspect_ratio") {
      mapping.aspectRatioKey = parsed.aspectRatioKey;
    }

    if (Array.isArray(parsed.supportedAspectRatios) && parsed.supportedAspectRatios.length > 0) {
      mapping.supportedAspectRatios = parsed.supportedAspectRatios.filter(
        (v: unknown): v is string => typeof v === "string"
      );
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

    // Return null if no mapping is needed
    if (
      !mapping.resolution &&
      !mapping.aspectRatioKey &&
      !mapping.supportedAspectRatios &&
      !mapping.imageInputKey &&
      !mapping.maxReferenceImages &&
      !mapping.extraDefaults
    ) {
      return null;
    }

    return mapping;
  } catch {
    return null;
  }
}

const ICON_PATTERNS: [RegExp, string][] = [
  [/^openai\/|gpt/i, "/icons/openai.svg"],
  [/^black-forest-labs\/|flux/i, "/icons/bfl.svg"],
  [/^google\/|gemini/i, "/icons/google.svg"],
  [/^bytedance\/|seedream/i, "/icons/bytedance.svg"],
];

export function inferIcon(modelId: string): string | undefined {
  for (const [pattern, icon] of ICON_PATTERNS) {
    if (pattern.test(modelId)) {
      return icon;
    }
  }
  return undefined;
}
