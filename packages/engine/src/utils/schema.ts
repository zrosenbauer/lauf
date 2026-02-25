/**
 * Shared JSON Schema introspection utilities for Zod-generated schemas.
 *
 * Used by both `help.ts` (for formatting CLI help text) and
 * `prompt-args.ts` (for prompting missing CLI arguments).
 */

export interface JsonSchemaProperty {
  readonly type?: string | readonly string[];
  readonly description?: string;
  readonly default?: unknown;
  readonly anyOf?: readonly JsonSchemaProperty[];
  readonly oneOf?: readonly JsonSchemaProperty[];
  readonly enum?: readonly unknown[];
}

/**
 * Extract the base type from an `anyOf` or `oneOf` array used by Zod
 * for nullable types.
 *
 * Zod emits nullable schemas as
 * `{ anyOf: [{ type: "string" }, { type: "null" }] }`.
 * This function extracts those inner types and joins them with ` | `.
 *
 * @param variants - Array of JSON Schema variant entries
 * @returns Joined type string, or `undefined` if no types found
 */
function extractVariantTypes(variants: readonly JsonSchemaProperty[]): string | undefined {
  const types = variants.flatMap((v) => {
    if (typeof v.type === 'string') {
      return [v.type];
    }
    if (Array.isArray(v.type)) {
      return v.type as string[];
    }
    return [];
  });

  if (types.length === 0) {
    return undefined;
  }

  return types.join(' | ');
}

/**
 * Resolve a JSON Schema property to a human-readable type string.
 *
 * Handles plain `type`, array `type`, and Zod-emitted `anyOf` / `oneOf`
 * wrappers for nullable/union schemas.  Falls back to `'string'` when no
 * type information can be extracted (safest default for CLI input).
 *
 * @param prop - A single JSON Schema property descriptor
 * @returns Resolved type string
 */
export function resolveType(prop: JsonSchemaProperty): string {
  if (typeof prop.type === 'string') {
    return prop.type;
  }
  if (Array.isArray(prop.type)) {
    const joined = prop.type.join(' | ');
    if (joined === '') {
      return 'string';
    }
    return joined;
  }

  // Handle nullable/optional types emitted by Zod as anyOf/oneOf
  if (prop.anyOf !== undefined && Array.isArray(prop.anyOf)) {
    const resolved = extractVariantTypes(prop.anyOf);
    if (resolved !== undefined) {
      return resolved;
    }
  }
  if (prop.oneOf !== undefined && Array.isArray(prop.oneOf)) {
    const resolved = extractVariantTypes(prop.oneOf);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return 'string';
}

function extractProperties(obj: Record<string, unknown>): Record<string, JsonSchemaProperty> {
  if (
    typeof obj.properties !== 'object' ||
    obj.properties === null ||
    Array.isArray(obj.properties)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(obj.properties as Record<string, unknown>).filter(
      ([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v),
    ),
  ) as Record<string, JsonSchemaProperty>;
}

function extractRequired(obj: Record<string, unknown>): readonly string[] {
  if (!Array.isArray(obj.required) || !obj.required.every((x: unknown) => typeof x === 'string')) {
    return [];
  }

  return obj.required as readonly string[];
}

/**
 * Safely extract properties and required fields from a raw JSON Schema
 * object produced by `z.toJSONSchema`.
 *
 * Validates that the expected fields exist and have the correct shape
 * before returning them, providing safe fallback defaults.
 *
 * @param raw - Raw JSON Schema output from `z.toJSONSchema`
 * @returns Object with validated `properties` and `required` fields
 */
export function extractSchemaFields(raw: unknown): {
  properties: Record<string, JsonSchemaProperty>;
  required: readonly string[];
} {
  if (typeof raw !== 'object' || raw === null) {
    return { properties: {}, required: [] };
  }

  const obj = raw as Record<string, unknown>;

  return {
    properties: extractProperties(obj),
    required: extractRequired(obj),
  };
}
