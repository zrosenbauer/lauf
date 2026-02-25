// oxlint-disable import/max-dependencies
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as p from '@clack/prompts';
import { attemptAsync } from 'es-toolkit';
import { z } from 'zod';

import { createContext } from './context/index.ts';
import { createPrompts } from './context/prompts.ts';
import type { ArgDefs, ScriptConfig } from './types.ts';
import { formatArgErrors, safeParseError } from './utils/cli.ts';
import { extractArgMeta, formatHelp } from './utils/help.ts';
import { safeParseJSON } from './utils/json.ts';
import { promptForMissingArgs } from './utils/prompt-args.ts';

const absolutePathString = z
  .string()
  .refine((val) => path.isAbsolute(val), 'Must be an absolute path');

const envSchema = z.object({
  LAUF_SCRIPT_PATH: absolutePathString,
  LAUF_ORIGINAL_PATH: absolutePathString,
  LAUF_ARGS: z.string(),
  LAUF_WORKSPACE_ROOT: absolutePathString,
  LAUF_PACKAGE_DIR: absolutePathString,
  LAUF_SCRIPT_NAME: z.string(),
  LAUF_SPINNER: z.enum(['0', '1']),
  LAUF_HELP: z.string().optional(),
});

/**
 * Entry point for script execution, spawned as a child process by the runner.
 *
 * This function is the bridge between the lauf CLI and user-authored scripts.
 * It runs in an isolated process so that script failures don't crash the CLI.
 *
 * The execution flow is:
 *  1. Parse and validate environment variables set by the runner
 *  2. Dynamically import the bundled script file (.mjs)
 *  3. Validate the user-provided arguments against the script's Zod schema
 *  4. Call the script's `run()` function with the assembled {@link ScriptContext}
 */
// oxlint-disable-next-line max-lines-per-function
async function execute(): Promise<void> {
  const envResult = envSchema.safeParse(process.env);
  if (!envResult.success) {
    p.log.error(`Invalid executor environment: ${formatArgErrors(envResult.error.issues)}`);
    process.exit(1);
  }

  const env = envResult.data;

  const [parseError, rawArgs] = safeParseJSON(env.LAUF_ARGS);
  if (parseError) {
    p.log.error(`Invalid JSON in LAUF_ARGS: failed to parse arguments`);
    process.exit(1);
  }

  // Validate that the original script path resolves within the workspace root
  // to prevent path traversal attacks via crafted LAUF_ORIGINAL_PATH values.
  const resolvedOriginalPath = path.resolve(env.LAUF_ORIGINAL_PATH);
  const resolvedWorkspaceRoot = path.resolve(env.LAUF_WORKSPACE_ROOT);
  if (
    !resolvedOriginalPath.startsWith(`${resolvedWorkspaceRoot}${path.sep}`) &&
    resolvedOriginalPath !== resolvedWorkspaceRoot
  ) {
    p.log.error(`Script path "${env.LAUF_SCRIPT_NAME}" is outside the workspace root`);
    process.exit(1);
  }

  // Import the bundled .mjs file (already transpiled by esbuild)
  // Use pathToFileURL for cross-platform compatibility (Windows requires file:// URLs for ESM import)
  const resolvedScriptPath = path.resolve(env.LAUF_SCRIPT_PATH);
  const scriptFileUrl = pathToFileURL(resolvedScriptPath).href;
  const [importError, mod] = await attemptAsync(
    () => import(scriptFileUrl) as Promise<{ default: ScriptConfig<ArgDefs> }>,
  );
  // es-toolkit's attemptAsync types require the null check for TS narrowing
  if (importError || mod === null) {
    p.log.error(
      `Failed to import script "${env.LAUF_SCRIPT_NAME}": ${safeParseError(importError)}`,
    );
    process.exit(1);
  }

  const config = mod.default;

  if (
    !config ||
    typeof config.description !== 'string' ||
    typeof config.args !== 'object' ||
    config.args === null ||
    typeof config.run !== 'function'
  ) {
    p.log.error(
      `Script "${env.LAUF_SCRIPT_NAME}" does not export a valid lauf() config (requires description, args, run)`,
    );
    process.exit(1);
  }

  if (env.LAUF_HELP === '1') {
    const argsMeta = extractArgMeta(config.args);
    p.log.message(formatHelp(env.LAUF_SCRIPT_NAME, config.description, argsMeta));
    process.exit(0);
  }

  // Prompt for any missing required args before validation
  const prompts = createPrompts();
  // rawArgs is the result of JSON.parse on a stringified Record<string, unknown> from the runner
  const [promptError, mergedArgs] = await promptForMissingArgs(
    config.args,
    rawArgs as Record<string, unknown>,
    prompts,
  );
  if (promptError) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  // Build a Zod object schema from the arg definitions and validate
  const argSchema = z.object(config.args);

  const parseResult = argSchema.safeParse(mergedArgs);

  if (!parseResult.success) {
    p.log.error(
      `Script "${env.LAUF_SCRIPT_NAME}" arg validation failed:\n${formatArgErrors(parseResult.error.issues)}`,
    );
    process.exit(1);
  }

  const ctx = createContext({
    args: parseResult.data,
    root: env.LAUF_WORKSPACE_ROOT,
    packageDir: env.LAUF_PACKAGE_DIR,
    name: env.LAUF_SCRIPT_NAME,
    spinner: env.LAUF_SPINNER === '1',
    logger: undefined,
  });

  const [runError, runResult] = await attemptAsync(() => Promise.resolve(config.run(ctx)));
  if (runError) {
    p.log.error(`Script "${env.LAUF_SCRIPT_NAME}" failed: ${safeParseError(runError)}`);
    process.exit(1);
  }

  /* v8 ignore next 3 -- requires script run() to return a non-zero number; not exercised in unit tests */
  if (typeof runResult === 'number' && runResult !== 0) {
    process.exit(runResult);
  }
}

const [topError] = await attemptAsync(execute);
if (topError) {
  p.log.error(`Script failed: ${safeParseError(topError)}`);
  process.exit(1);
}
