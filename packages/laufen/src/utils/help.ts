import chalk from 'chalk';
import { z } from 'zod';

import type { ArgDefs } from '../types.ts';
import { extractSchemaFields, resolveType } from './schema.ts';

interface ArgMeta {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly defaultValue: unknown;
  readonly required: boolean;
}

function formatSuffix(meta: ArgMeta): string {
  if (meta.required) {
    return chalk.red('(required)');
  }
  if (meta.defaultValue !== undefined) {
    return chalk.dim(`[default: ${String(meta.defaultValue)}]`);
  }
  return '';
}

function formatFlag(meta: ArgMeta, maxWidth: number): string {
  const flag = `--${meta.name} <${meta.type}>`;
  const padded = flag.padEnd(maxWidth + 4);
  const suffix = formatSuffix(meta);
  if (suffix) {
    return `  ${padded}${meta.description} ${suffix}`;
  }
  return `  ${padded}${meta.description}`;
}

/**
 * Extract argument metadata from Zod arg definitions via JSON Schema introspection.
 *
 * Builds a `z.object()` from the arg definitions, converts to JSON Schema,
 * and maps the schema properties into a typed `ArgMeta[]`.
 *
 * @param args - Zod arg definitions from the script config
 * @returns Array of argument metadata for formatting
 */
export function extractArgMeta(args: ArgDefs): readonly ArgMeta[] {
  const schema = z.object(args);
  const rawJsonSchema = z.toJSONSchema(schema);
  const { properties, required } = extractSchemaFields(rawJsonSchema);

  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: resolveType(prop),
    description: prop.description || '',
    defaultValue: prop.default,
    required: prop.default === undefined && required.includes(name),
  }));
}

/**
 * Format help output for a script's arguments.
 *
 * @param scriptName - The script's qualified name
 * @param description - The script's human-readable description
 * @param argsMeta - Extracted argument metadata
 * @returns Formatted help string ready for `console.log`
 */
export function formatHelp(
  scriptName: string,
  description: string,
  argsMeta: readonly ArgMeta[],
): string {
  const header = `${chalk.cyan(scriptName)}\n\n  ${description}`;

  if (argsMeta.length === 0) {
    return `${header}\n\n  No flags defined.`;
  }

  const maxFlagWidth = argsMeta.reduce(
    (max, meta) => Math.max(max, `--${meta.name} <${meta.type}>`.length),
    0,
  );

  const flagLines = argsMeta.map((meta) => formatFlag(meta, maxFlagWidth));

  return `${header}\n\n${chalk.bold('FLAGS:')}\n\n${flagLines.join('\n')}`;
}
