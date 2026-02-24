import { z } from 'zod';

import type { ArgDefs, PromptResult, Prompts } from '../types.ts';
import { extractSchemaFields, resolveType } from './schema.ts';

interface MissingArg {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly enumValues: readonly unknown[] | undefined;
}

function findMissingArgs(
  rawSchema: unknown,
  rawArgs: Record<string, unknown>,
): readonly MissingArg[] {
  const { properties, required } = extractSchemaFields(rawSchema);

  return Object.entries(properties)
    .filter(([name]) => required.includes(name) && !(name in rawArgs))
    .map(([name, prop]) => ({
      name,
      type: resolveType(prop),
      description: prop.description || name,
      enumValues: prop.enum,
    }));
}

function promptSingleArg(prompts: Prompts, arg: MissingArg): Promise<PromptResult<unknown>> {
  if (arg.enumValues !== undefined) {
    return prompts.select({
      message: arg.description,
      options: arg.enumValues.map((v) => ({ value: v, label: String(v) })),
    });
  }
  if (arg.type === 'boolean') {
    return prompts.confirm({ message: arg.description });
  }
  if (arg.type === 'number' || arg.type === 'integer') {
    return promptNumber(prompts, arg.description);
  }
  return prompts.text({ message: arg.description });
}

async function promptNumber(prompts: Prompts, message: string): Promise<PromptResult<unknown>> {
  const result = await prompts.text({
    message,
    validate: (v) => {
      if (v === undefined || v === '') {
        return 'A value is required';
      }
      if (Number.isNaN(Number(v))) {
        return 'Must be a valid number';
      }
    },
  });
  if (result[0] !== null) {
    return [result[0], null];
  }
  return [null, Number(result[1])];
}

async function promptSequentially(
  prompts: Prompts,
  remaining: readonly MissingArg[],
  collected: Record<string, unknown>,
): Promise<PromptResult<Record<string, unknown>>> {
  const first = remaining[0];
  if (first === undefined) {
    return [null, collected];
  }
  const result = await promptSingleArg(prompts, first);
  if (result[0] !== null) {
    return [result[0], null];
  }
  return promptSequentially(prompts, remaining.slice(1), {
    ...collected,
    [first.name]: result[1],
  });
}

/**
 * Prompt the user for any required args not present in rawArgs.
 *
 * Uses JSON Schema introspection on the Zod arg definitions to determine
 * which args are missing and what prompt type to show for each.
 *
 * @param argDefs - Zod arg definitions from the script config
 * @param rawArgs - Args already provided via CLI flags
 * @param prompts - Injected prompt interface for testability
 * @returns Merged args (rawArgs + prompted values), or cancellation
 */
export function promptForMissingArgs(
  argDefs: ArgDefs,
  rawArgs: Record<string, unknown>,
  prompts: Prompts,
): Promise<PromptResult<Record<string, unknown>>> {
  const rawJsonSchema = z.toJSONSchema(z.object(argDefs));
  const missingArgs = findMissingArgs(rawJsonSchema, rawArgs);

  if (missingArgs.length === 0) {
    return Promise.resolve([null, rawArgs]);
  }

  return promptSequentially(prompts, missingArgs, rawArgs);
}
