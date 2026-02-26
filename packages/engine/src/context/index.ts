import type { ArgDefs, DefaultLogger, InferArgs, ScriptContext } from '../types.ts';
import { createLogger } from './logger.ts';
import { createPrompts } from './prompts.ts';
import { createNoopSpinner, createSpinner } from './spinner.ts';

interface CreateContextParams<T extends ArgDefs> {
  readonly args: InferArgs<T>;
  readonly root: string;
  readonly packageDir: string;
  readonly name: string;
  readonly spinner: boolean;
  readonly logger: DefaultLogger | undefined;
}

function resolveSpinner(enabled: boolean) {
  if (enabled) {
    return createSpinner();
  }
  return createNoopSpinner();
}

export function createContext<T extends ArgDefs>(params: CreateContextParams<T>): ScriptContext<T> {
  return {
    args: params.args,
    root: params.root,
    packageDir: params.packageDir,
    name: params.name,
    logger: params.logger ?? createLogger(),
    spinner: resolveSpinner(params.spinner),
    prompts: createPrompts(),
  };
}
