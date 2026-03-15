// oxlint-disable import/max-dependencies
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { cancel } from '@clack/prompts';
import { attemptAsync } from 'es-toolkit';
import { z } from 'zod';

import { createContext } from './context/index.ts';
import { createLogger } from './context/logger.ts';
import { createPrompts } from './context/prompts.ts';
import { applyEnvToProcess, resolveEnvValue } from './env.ts';
import type { ArgDefs, EnvContext, ScriptConfig } from './types.ts';
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
  LAUF_HELP: z.enum(['0', '1']).optional(),
  LAUF_ENV: z.string().optional(),
  LAUF_CLI_ENV: z.string().optional(),
  LAUF_WATCH_ENABLED: z.enum(['0', '1']).default('0'),
  LAUF_WATCH_CHANGED: z.string().default('[]'),
  LAUF_WATCH_PATTERNS: z.string().default('[]'),
});

const laufEnvSchema = z.record(z.string(), z.string());

/**
 * Parse `LAUF_ENV` JSON string into a record, or return an empty record if absent.
 */
function parseLaufEnv(
  raw: string | undefined,
): readonly [Error, null] | readonly [null, Record<string, string>] {
  if (raw === undefined) {
    return [null, {}];
  }
  return safeParseJSON(raw, laufEnvSchema);
}

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
  const log = createLogger();

  const envResult = envSchema.safeParse(process.env);
  if (!envResult.success) {
    log.error(`Invalid executor environment: ${formatArgErrors(envResult.error.issues)}`);
    process.exit(1);
  }

  const env = envResult.data;

  const [parseError, rawArgs] = safeParseJSON(env.LAUF_ARGS, z.record(z.string(), z.unknown()));
  if (parseError) {
    log.error(`Invalid JSON in LAUF_ARGS: failed to parse arguments`);
    process.exit(1);
  }

  // Validate that the original script path resolves within the workspace root
  // to prevent path traversal attacks via crafted LAUF_ORIGINAL_PATH values.
  const resolvedOriginalPath = path.resolve(env.LAUF_ORIGINAL_PATH);
  const resolvedWorkspaceRoot = path.resolve(env.LAUF_WORKSPACE_ROOT);
  const relativePath = path.relative(resolvedWorkspaceRoot, resolvedOriginalPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    log.error(`Script path "${env.LAUF_SCRIPT_NAME}" is outside the workspace root`);
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
    log.error(`Failed to import script "${env.LAUF_SCRIPT_NAME}": ${safeParseError(importError)}`);
    process.exit(1);
  }

  const config = mod.default;

  if (!config || typeof config.description !== 'string' || typeof config.run !== 'function') {
    log.error(
      `Script "${env.LAUF_SCRIPT_NAME}" does not export a valid lauf() config (requires description, run)`,
    );
    process.exit(1);
  }

  if (
    config.args !== undefined &&
    (typeof config.args !== 'object' || config.args === null || Array.isArray(config.args))
  ) {
    log.error(
      `Script "${env.LAUF_SCRIPT_NAME}" has invalid args: expected a plain object or undefined`,
    );
    process.exit(1);
  }

  // Parse pre-merged env (config.env) from runner
  const parsedEnv = parseLaufEnv(env.LAUF_ENV);
  if (parsedEnv[0]) {
    log.error('Invalid JSON in LAUF_ENV: failed to parse environment');
    process.exit(1);
  }
  const premergedEnv = parsedEnv[1];

  // Parse CLI --env flags (highest priority layer)
  const parsedCliEnv = parseLaufEnv(env.LAUF_CLI_ENV);
  if (parsedCliEnv[0]) {
    log.error('Invalid JSON in LAUF_CLI_ENV: failed to parse CLI environment');
    process.exit(1);
  }
  const cliEnv = parsedCliEnv[1];

  // Build EnvContext for script-level env function resolution
  const envCtx: EnvContext = {
    script: {
      name: env.LAUF_SCRIPT_NAME,
      path: env.LAUF_ORIGINAL_PATH,
      packageDir: env.LAUF_PACKAGE_DIR,
    },
    workspace: env.LAUF_WORKSPACE_ROOT,
  };

  // Resolve script-level env (may be a function)
  const [scriptEnvError, scriptEnv] = await resolveEnvValue(config.env, envCtx);
  if (scriptEnvError) {
    log.error(
      `Failed to resolve script env for "${env.LAUF_SCRIPT_NAME}": ${safeParseError(scriptEnvError)}`,
    );
    process.exit(1);
  }

  // Merge order: config.env < script.env < CLI --env
  const resolvedEnv: Record<string, string> = { ...premergedEnv, ...scriptEnv, ...cliEnv };

  // Filter LAUF_ prefixed keys to prevent overwriting internal control variables
  const safeResolvedEnv = Object.fromEntries(
    Object.entries(resolvedEnv).filter(([key]) => !key.startsWith('LAUF_')),
  );
  applyEnvToProcess(safeResolvedEnv);

  if (env.LAUF_HELP === '1') {
    const argsMeta = extractArgMeta(config.args ?? {});
    log.message(formatHelp(env.LAUF_SCRIPT_NAME, config.description, argsMeta));
    process.exit(0);
  }

  // Prompt for any missing required args before validation
  const prompts = createPrompts();
  const [promptError, mergedArgs] = await promptForMissingArgs(config.args ?? {}, rawArgs, prompts);
  if (promptError) {
    cancel('Cancelled');
    process.exit(0);
  }

  // Build a Zod object schema from the arg definitions and validate
  const argSchema = z.object(config.args ?? {});

  const parseResult = argSchema.safeParse(mergedArgs);

  if (!parseResult.success) {
    log.error(
      `Script "${env.LAUF_SCRIPT_NAME}" arg validation failed:\n${formatArgErrors(parseResult.error.issues)}`,
    );
    process.exit(1);
  }

  const watchEnabled = env.LAUF_WATCH_ENABLED === '1';
  const [, watchChanged] = safeParseJSON(env.LAUF_WATCH_CHANGED, z.array(z.string()));
  const [, watchPatterns] = safeParseJSON(env.LAUF_WATCH_PATTERNS, z.array(z.string()));

  const ctx = createContext({
    args: parseResult.data,
    env: resolvedEnv,
    root: env.LAUF_WORKSPACE_ROOT,
    packageDir: env.LAUF_PACKAGE_DIR,
    name: env.LAUF_SCRIPT_NAME,
    spinner: env.LAUF_SPINNER === '1',
    logger: undefined,
    watch: {
      enabled: watchEnabled,
      changedFiles: watchChanged ?? [],
      patterns: watchPatterns ?? [],
    },
  });

  const [runError, runResult] = await attemptAsync(() => Promise.resolve(config.run(ctx)));
  if (runError) {
    log.error(`Script "${env.LAUF_SCRIPT_NAME}" failed: ${safeParseError(runError)}`);
    process.exit(1);
  }

  /* v8 ignore next 3 -- requires script run() to return a non-zero number; not exercised in unit tests */
  if (typeof runResult === 'number' && runResult !== 0) {
    process.exit(runResult);
  }
}

const [topError] = await attemptAsync(execute);
if (topError) {
  const topLog = createLogger();
  topLog.error(`Script failed: ${safeParseError(topError)}`);
  process.exit(1);
}
