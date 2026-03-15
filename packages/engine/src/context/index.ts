import type { ArgDefs, DefaultLogger, InferArgs, ScriptContext, WatchContext } from '../types.ts';
import { createFsHelpers } from './fs.ts';
import { createLogger } from './logger.ts';
import { createPrompts } from './prompts.ts';
import { createNoopSpinner, createSpinner } from './spinner.ts';

interface CreateContextParams<T extends ArgDefs> {
  readonly args: InferArgs<T>;
  readonly env: Record<string, string>;
  readonly root: string;
  readonly packageDir: string;
  readonly name: string;
  readonly spinner: boolean;
  readonly logger: DefaultLogger | undefined;
  readonly watch: WatchContext;
}

function resolveSpinner(enabled: boolean) {
  if (enabled) {
    return createSpinner();
  }
  return createNoopSpinner();
}

const warnedDeprecations = new Set<string>();

function warnDeprecation(key: string, replacement: string): void {
  if (warnedDeprecations.has(key)) {
    return;
  }
  warnedDeprecations.add(key);
  console.warn(`[lauf] ctx.${key} is deprecated, use ctx.${replacement} instead`);
}

export function createContext<T extends ArgDefs>(params: CreateContextParams<T>): ScriptContext<T> {
  const fsHelpers = createFsHelpers(params.packageDir);
  const watch = Object.freeze({
    enabled: params.watch.enabled,
    changedFiles: Object.freeze([...params.watch.changedFiles]),
    patterns: Object.freeze([...params.watch.patterns]),
  });

  return {
    args: params.args,
    env: Object.freeze(params.env),
    dir: {
      root: params.root,
      package: params.packageDir,
      workspace: params.packageDir,
    },
    get root() {
      warnDeprecation('root', 'dir.root');
      return params.root;
    },
    get packageDir() {
      warnDeprecation('packageDir', 'dir.package');
      return params.packageDir;
    },
    name: params.name,
    logger: params.logger ?? createLogger(),
    spinner: resolveSpinner(params.spinner),
    prompts: createPrompts(),
    fs: fsHelpers,
    import: <K extends keyof LaufPackages.Registry & string>(
      packageName: K,
    ): Promise<LaufPackages.Registry[K]> =>
      import(packageName as string) as Promise<LaufPackages.Registry[K]>,
    watch,
  };
}
