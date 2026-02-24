// Execution
export { runScript } from './runner.ts';
export { loadDescriptions } from './metadata.ts';
export { bundleScript } from './bundler.ts';

// Context
export { createContext } from './context/index.ts';
export { createLogger } from './context/logger.ts';
export { createPrompts } from './context/prompts.ts';
export { createSpinner, createNoopSpinner } from './context/spinner.ts';

// Types
export type {
  ArgDefs,
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
} from './types.ts';
export type { Result } from './result.ts';
export type { RunScriptOptions } from './runner.ts';
export type { BundleResult } from './bundler.ts';
