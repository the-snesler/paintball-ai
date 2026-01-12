import type { ModelCapabilities } from '~/types';

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
 * Fetch model info and parse capabilities from Replicate API schema
 */
export async function fetchModelInfo(modelId: string, apiKey: string): Promise<{
  name: string;
  capabilities: ModelCapabilities;
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

  const capabilities = parseCapabilities(properties);

  // Extract a nice display name from the model ID or response
  const name = data.name || modelId.split('/').pop() || modelId;

  return { name, capabilities };
}

/**
 * Parse schema properties into our ModelCapabilities format
 */
function parseCapabilities(properties: Record<string, SchemaProperty>): ModelCapabilities {
  // Check for aspect ratio support
  const supportsAspectRatios = !!(
    properties.aspect_ratio ||
    properties.aspectRatio ||
    properties.output_aspect_ratio
  );

  // Check for resolution/megapixels support
  const supportsResolution = !!(
    properties.resolution ||
    properties.megapixels ||
    properties.output_resolution
  );

  // Check for reference image support - various property names used
  const imageProps = [
    'image',
    'image_input',
    'input_image',
    'reference_image',
    'init_image',
    'control_image',
  ];

  const imageProperty = imageProps.find(prop => properties[prop]);
  const supportsReferenceImages = !!imageProperty;

  // Infer max reference images
  let maxReferenceImages = 1;
  if (imageProperty) {
    const prop = properties[imageProperty];
    // If it's an array type, allow multiple
    if (prop.type === 'array') {
      maxReferenceImages = 10; // Default max for array inputs
    }
  }

  return {
    supportsAspectRatios,
    supportsResolution,
    supportsReferenceImages,
    maxReferenceImages,
  };
}
