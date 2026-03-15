import type { Result } from '../result.ts';
import { preparePackages } from './manager.ts';
import { extractPackages } from './metadata.ts';

export interface PackagePreparationResult {
  readonly cacheDir: string;
  readonly packageNames: readonly string[];
}

/**
 * Extract and prepare packages for a script.
 *
 * Combines package extraction from script config, merging with workspace packages,
 * and preparation (installation to cache).
 *
 * Returns null for both values when no packages are needed.
 *
 * @param scriptPath - Absolute path to script file
 * @param workspacePackages - Workspace-level packages from config
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Result containing preparation details or null if no packages
 */
export async function extractAndPreparePackages(
  scriptPath: string,
  workspacePackages: Record<string, string>,
  workspaceRoot: string,
): Promise<Result<PackagePreparationResult | null>> {
  const [extractError, scriptPackages] = await extractPackages(scriptPath);
  if (extractError) {
    return [extractError, null];
  }

  const mergedPackages = { ...workspacePackages, ...scriptPackages };
  const packageNames = Object.keys(mergedPackages);

  if (packageNames.length === 0) {
    return [null, null];
  }

  const [prepareError, prepared] = await preparePackages(mergedPackages, workspaceRoot);
  if (prepareError) {
    return [prepareError, null];
  }

  return [null, { cacheDir: prepared.cacheDir, packageNames: prepared.packageNames }];
}
