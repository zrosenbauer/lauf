import type { Stats } from 'node:fs';

import type { ArgDefs, ScriptConfig, WatchConfig } from '@laufen/engine';
import { watch as chokidarWatch } from 'chokidar';
import { attemptAsync } from 'es-toolkit';
import { createJiti } from 'jiti';
import picomatch from 'picomatch';

const DEFAULT_IGNORED: readonly string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/.turbo/**',
  '**/coverage/**',
];

const DEFAULT_DEBOUNCE = 100;

export interface WatcherHandle {
  readonly cleanup: () => Promise<void>;
}

/**
 * Merge global and script-level watch configs.
 *
 * Patterns are concatenated (global first, then script).
 * Script-level debounce takes precedence over global.
 * Ignored patterns are merged from both.
 */
export function mergeWatchConfig(
  globalConfig: WatchConfig | undefined,
  scriptConfig: WatchConfig | undefined,
): WatchConfig | undefined {
  if (globalConfig === undefined && scriptConfig === undefined) {
    return undefined;
  }
  if (globalConfig === undefined) {
    return scriptConfig;
  }
  if (scriptConfig === undefined) {
    return globalConfig;
  }
  return {
    patterns: [...globalConfig.patterns, ...scriptConfig.patterns],
    debounce: scriptConfig.debounce ?? globalConfig.debounce,
    ignored: [...(globalConfig.ignored ?? []), ...(scriptConfig.ignored ?? [])],
  };
}

/**
 * Attempt to load a script's watch config via jiti.
 *
 * Returns `undefined` if the script cannot be imported or has no watch config.
 * Failures are silent — the handler falls back to global config only.
 */
export async function loadScriptWatchConfig(scriptPath: string): Promise<WatchConfig | undefined> {
  const jiti = createJiti(scriptPath, {
    interopDefault: true,
    moduleCache: false,
  });

  const [importError, mod] = await attemptAsync(
    () => jiti.import(scriptPath) as Promise<{ default: ScriptConfig<ArgDefs> }>,
  );

  if (importError !== null || mod === null) {
    return undefined;
  }

  const config = mod.default;
  if (!config || typeof config.description !== 'string') {
    return undefined;
  }

  return config.watch;
}

/**
 * Create a chokidar file watcher with debounced change accumulation.
 *
 * Collects all changed files within the debounce window into a single batch,
 * then invokes `onChange` with the full set of changed paths.
 *
 * @param config - Watch configuration (patterns, debounce, ignored)
 * @param cwd - Base directory for resolving glob patterns
 * @param onChange - Called with changed file paths (relative to cwd)
 * @returns Promise resolving to a handle with a cleanup function
 */
// oxlint-disable-next-line max-lines-per-function
export function createWatcher(
  config: WatchConfig,
  cwd: string,
  onChange: (changedFiles: readonly string[]) => void,
): Promise<WatcherHandle> {
  const debounce = config.debounce ?? DEFAULT_DEBOUNCE;
  const userIgnored = [...DEFAULT_IGNORED, ...(config.ignored ?? [])];
  const isIncluded = picomatch([...config.patterns]);
  const isUserIgnored = picomatch(userIgnored);

  // Chokidar v5 no longer expands globs in watch paths.
  // Watch the cwd directory and use an ignored function to filter
  // files to only those matching the configured patterns.
  const ignored = (filePath: string, stats: Stats | undefined): boolean => {
    if (isUserIgnored(filePath)) {
      return true;
    }
    // Don't ignore directories — chokidar needs to traverse into them
    if (stats !== undefined && stats.isDirectory()) {
      return false;
    }
    return !isIncluded(filePath);
  };

  return new Promise((resolve, reject) => {
    const changedFiles = new Set<string>();
    const timerRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };

    const scheduleCallback = (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        const files = Array.from(changedFiles);
        changedFiles.clear();
        timerRef.current = null;
        onChange(files);
      }, debounce);
    };

    const handleChange = (filePath: string): void => {
      changedFiles.add(filePath);
      scheduleCallback();
    };

    const watcher = chokidarWatch('.', {
      cwd,
      ignored,
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('add', handleChange);
    watcher.on('change', handleChange);
    watcher.on('unlink', handleChange);

    watcher.on('ready', () => {
      resolve({
        cleanup: (): Promise<void> => {
          if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
          }
          return watcher.close();
        },
      });
    });

    watcher.on('error', (err: unknown) => {
      reject(err);
    });
  });
}
