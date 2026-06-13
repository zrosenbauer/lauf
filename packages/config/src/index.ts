// Re-export Zod for ergonomic `import { z } from 'laufen'` (via the meta package).
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
export { defineConfig, lauf } from './factory.ts';

// Config loading API.
export type { LaufConfig, LoadedConfig, ResolvedLaufConfig } from './config.ts';
export {
  loadAllLaufConfigs,
  loadLaufConfig,
  loadLaufConfigWithMeta,
  safeLoadLaufConfig,
  safeLoadLaufConfigWithMeta,
} from './config.ts';

// Env helpers.
export { dotenv } from './env.ts';
export type { InfisicalConfig } from './infisical.ts';
export { infisical } from './infisical.ts';

// Internal Result tuple type — exposed so downstream packages (cli, callers)
// can keep a single shape for fallible operations.
export type { HandlerError, HandlerResult, Result } from './result.ts';
export { assertOk, fail, ok } from './result.ts';

// JSON parsing helper used both internally and by the CLI for argv parsing.
export { safeParseJSON } from './utils/json.ts';
