export { runScript } from './runner.ts';
export { loadDescriptions } from './metadata.ts';
export { buildBaseEnv, applyEnvToProcess, resolveEnvValue } from './env.ts';
export { bundleScript } from './bundler.ts';
export { extractArgMeta, formatHelp } from './utils/help.ts';
export { createContext } from './context/index.ts';
export { createLogger } from './context/logger.ts';
export { createPrompts } from './context/prompts.ts';
export { createSpinner, createNoopSpinner } from './context/spinner.ts';
export { extractSchemaFields, resolveType } from './utils/schema.ts';
export type { JsonSchemaProperty } from './utils/schema.ts';
export type {
  ArgDefs,
  EnvContext,
  EnvFn,
  FsHelpers,
  InferArgs,
  ScriptConfig,
  ScriptContext,
  ScriptTarget,
  RunResult,
  Logger,
  DefaultLogger,
  Spinner,
  Prompts,
  PromptOption,
  PromptCancelled,
  PromptResult,
  WatchConfig,
  WatchContext,
} from './types.ts';
export type { Result } from './result.ts';
export type { RunScriptOptions } from './runner.ts';
export type { BundleResult } from './bundler.ts';
