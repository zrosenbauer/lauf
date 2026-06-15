// Zod re-export for ergonomic `import { z } from 'laufen'`.
export { z } from 'zod';

// Script-author types re-exported from the engine.
export type {
  ArgDefs,
  DefaultLogger,
  EnvContext,
  EnvFn,
  FsHelpers,
  InferArgs,
  Logger,
  PromptCancelled,
  PromptOption,
  PromptResult,
  Prompts,
  ScriptConfig,
  ScriptContext,
  Spinner,
  WatchConfig,
  WatchContext,
} from '@laufen/engine';

// Public factories.
export { defineConfig, lauf } from './factory/index.ts';

// Config types + loaders.
export type { EnvValue, LaufConfig, LoadedConfig, ResolvedLaufConfig } from './config/index.ts';
export {
  loadAllLaufConfigs,
  loadLaufConfig,
  loadLaufConfigWithMeta,
  safeLoadLaufConfig,
  safeLoadLaufConfigWithMeta,
} from './config/index.ts';

// Env helpers.
export type { InfisicalConfig } from './env/index.ts';
export { dotenv, infisical } from './env/index.ts';

// Result primitives (re-exported from massaman/control) — exposed so
// downstream packages keep a single shape for fallible operations.
export type { Err, Ok, Result } from './result.ts';
export { attempt, attemptAsync, err, isErr, isOk, ok, unwrap } from './result.ts';

// JSON parsing helper used both internally and by the CLI.
export { safeParseJSON } from './utils/json.ts';
