import type { Result } from '../result.ts';
import { attemptAsync } from '../result.ts';
import { loadLaufConfig, loadLaufConfigWithMeta } from './load.ts';
import type { LoadedConfig, ResolvedLaufConfig } from './types.ts';

/**
 * Load the closest lauf config and return a {@link Result} instead of
 * rejecting on failure.
 */
export function safeLoadLaufConfig(cwd: string): Promise<Result<ResolvedLaufConfig>> {
  return attemptAsync(() => loadLaufConfig(cwd));
}

/**
 * Load the closest lauf config with metadata, returning a {@link Result}.
 */
export function safeLoadLaufConfigWithMeta(cwd: string): Promise<Result<LoadedConfig>> {
  return attemptAsync(() => loadLaufConfigWithMeta(cwd));
}
