export interface OpenApiSchemaProperty {
  type?: string;
  enum?: string[];
  items?: { type: string; format?: string };
  default?: unknown;
  description?: string;
  title?: string;
  $ref?: string;
  allOf?: Array<{ $ref?: string } & Partial<OpenApiSchemaProperty>>;
  anyOf?: Array<{ $ref?: string } & Partial<OpenApiSchemaProperty>>;
  oneOf?: Array<{ $ref?: string } & Partial<OpenApiSchemaProperty>>;
}

export function resolveSchemaRef(
  ref: string,
  schemas: Record<string, OpenApiSchemaProperty>
): OpenApiSchemaProperty | undefined {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  return match ? schemas[match[1]] : undefined;
}

export function dereferenceProperties(
  properties: Record<string, OpenApiSchemaProperty>,
  schemas: Record<string, OpenApiSchemaProperty>
): Record<string, OpenApiSchemaProperty> {
  const result: Record<string, OpenApiSchemaProperty> = {};
  for (const [key, prop] of Object.entries(properties)) {
    const collected: Partial<OpenApiSchemaProperty> = {};

    for (const compositionKey of ["allOf", "anyOf", "oneOf"] as const) {
      for (const item of prop[compositionKey] ?? []) {
        if (item.$ref) {
          const resolved = resolveSchemaRef(item.$ref, schemas);
          if (resolved) Object.assign(collected, resolved);
        } else {
          const { $ref: _, ...rest } = item;
          Object.assign(collected, rest);
        }
      }
    }
    if (prop.$ref) {
      const resolved = resolveSchemaRef(prop.$ref, schemas);
      if (resolved) Object.assign(collected, resolved);
    }

    const { $ref, allOf, anyOf, oneOf, ...ownFields } = prop;
    result[key] = { ...collected, ...ownFields };
  }
  return result;
}
