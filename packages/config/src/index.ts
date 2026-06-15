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

// Config types + loader factory.
export type {
  ConfigLoader,
  ConfigLoaderOptions,
  EnvValue,
  LaufConfig,
  LoadedConfig,
  ResolvedLaufConfig,
} from './config/index.ts';
export { createConfigLoader } from './config/index.ts';

// Env helpers.
export type { InfisicalConfig } from './env/index.ts';
export { dotenv, infisical } from './env/index.ts';
