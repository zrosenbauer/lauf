import * as fs from 'node:fs';
import * as path from 'node:path';

import { attempt } from 'es-toolkit';
import * as yaml from 'yaml';

import { safeParseJSON } from '../utils/json.ts';

const MAX_PARENT_ITERATIONS = 200;

type WorkspaceManager = 'pnpm' | 'npm' | 'yarn' | 'bun' | 'lerna' | 'single';

interface WorkspaceInfo {
  readonly manager: WorkspaceManager;
  readonly root: string;
  readonly globs: readonly string[];
}

interface WorkspaceDetector {
  readonly manager: WorkspaceManager;
  readonly marker: string;
  readonly extractGlobs: (content: string) => readonly string[] | undefined;
}

/**
 * Safe YAML parse wrapper matching the `safeParseJSON` convention.
 *
 * @param content - Raw YAML string
 * @returns Tuple of [error, result]
 */
function safeParseYaml(content: string): [Error, null] | [null, unknown] {
  return attempt(() => yaml.parse(content) as unknown);
}

/**
 * Validate that every element in an array is a string.
 *
 * @param arr - Array to validate
 * @returns `true` if all elements are strings
 */
function isStringArray(arr: readonly unknown[]): arr is readonly string[] {
  return arr.every((x) => typeof x === 'string');
}

/**
 * Extract workspace globs from `pnpm-workspace.yaml`.
 *
 * @param content - Raw YAML content
 * @returns Array of glob patterns, or `undefined` if parsing fails
 */
function extractPnpmGlobs(content: string): readonly string[] | undefined {
  const [err, config] = safeParseYaml(content);
  if (err) {
    return undefined;
  }
  if (
    config &&
    typeof config === 'object' &&
    'packages' in config &&
    Array.isArray(config.packages) &&
    isStringArray(config.packages)
  ) {
    return config.packages;
  }
  return undefined;
}

/**
 * Extract workspace globs from `package.json`.
 *
 * Handles both `"workspaces": [...]` and `"workspaces": { "packages": [...] }` shapes.
 *
 * @param content - Raw JSON content
 * @returns Array of glob patterns, or `undefined` if no workspaces field
 */
function extractPackageJsonGlobs(content: string): readonly string[] | undefined {
  const [err, parsed] = safeParseJSON(content);
  if (err || parsed === null) {
    return undefined;
  }

  /* v8 ignore next 3 -- defensive: safeParseJSON only returns objects/arrays for valid JSON */
  if (typeof parsed !== 'object') {
    return undefined;
  }

  const pkg = parsed as Record<string, unknown>;
  const workspaces = pkg.workspaces;

  if (Array.isArray(workspaces) && isStringArray(workspaces)) {
    return workspaces;
  }

  if (workspaces && typeof workspaces === 'object' && 'packages' in workspaces) {
    const inner = (workspaces as Record<string, unknown>).packages;
    if (Array.isArray(inner) && isStringArray(inner)) {
      return inner;
    }
  }

  return undefined;
}

/**
 * Extract workspace globs from `lerna.json`.
 *
 * @param content - Raw JSON content
 * @returns Array of glob patterns, or `undefined` if parsing fails
 */
function extractLernaGlobs(content: string): readonly string[] | undefined {
  const [err, parsed] = safeParseJSON(content);
  if (err || !parsed || typeof parsed !== 'object') {
    return undefined;
  }
  const config = parsed as Record<string, unknown>;
  if (Array.isArray(config.packages) && isStringArray(config.packages)) {
    return config.packages;
  }
  return undefined;
}

/**
 * Ordered list of workspace detectors, checked in priority order.
 *
 * pnpm is checked first (dedicated workspace file), then package.json
 * workspaces (npm/yarn/bun), then lerna.
 */
const DETECTORS: readonly WorkspaceDetector[] = [
  { manager: 'pnpm', marker: 'pnpm-workspace.yaml', extractGlobs: extractPnpmGlobs },
  { manager: 'npm', marker: 'package.json', extractGlobs: extractPackageJsonGlobs },
  { manager: 'lerna', marker: 'lerna.json', extractGlobs: extractLernaGlobs },
];

/**
 * Refine manager name for package.json-based workspaces by checking lockfiles.
 *
 * @param dir - Directory to check for lockfiles
 * @returns Refined manager name
 */
function refinePackageJsonManager(dir: string): WorkspaceManager {
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(dir, 'bun.lockb')) || fs.existsSync(path.join(dir, 'bun.lock'))) {
    return 'bun';
  }
  return 'npm';
}

/**
 * Resolve the manager for a given detector match.
 *
 * @param dir - Directory where the marker was found
 * @param detector - The matched detector
 * @returns Resolved workspace manager
 */
function resolveManager(dir: string, detector: WorkspaceDetector): WorkspaceManager {
  if (detector.marker === 'package.json') {
    return refinePackageJsonManager(dir);
  }
  return detector.manager;
}

/**
 * Try a single detector against a directory.
 *
 * @param dir - Directory to scan
 * @param detector - Detector to try
 * @returns WorkspaceInfo if the detector matches, or `undefined`
 */
function detectFromMarker(dir: string, detector: WorkspaceDetector): WorkspaceInfo | undefined {
  const markerPath = path.join(dir, detector.marker);
  if (!fs.existsSync(markerPath)) {
    return undefined;
  }
  const content = fs.readFileSync(markerPath, 'utf-8');
  const globs = detector.extractGlobs(content);
  if (globs === undefined) {
    return undefined;
  }
  const manager = resolveManager(dir, detector);
  return { manager, root: dir, globs };
}

/**
 * Try all detectors against a single directory.
 *
 * @param dir - Directory to scan
 * @returns WorkspaceInfo if any detector matches, or `undefined`
 */
function tryDetectors(dir: string): WorkspaceInfo | undefined {
  const results = DETECTORS.map((detector) => detectFromMarker(dir, detector));
  return results.find((r): r is WorkspaceInfo => r !== null && r !== undefined);
}

/**
 * Walk up from `startDir` checking each directory for workspace markers.
 *
 * @param startDir - Starting directory
 * @returns WorkspaceInfo for the detected workspace, or a `'single'` fallback
 */
function resolveWorkspace(startDir: string = process.cwd()): WorkspaceInfo {
  const walk = (dir: string, prevDir: string, iterations: number): WorkspaceInfo => {
    if (dir === prevDir || iterations >= MAX_PARENT_ITERATIONS) {
      return { manager: 'single', root: startDir, globs: [] };
    }

    const detected = tryDetectors(dir);
    if (detected) {
      return detected;
    }

    return walk(path.dirname(dir), dir, iterations + 1);
  };

  return walk(startDir, '', 0);
}

/**
 * Module-level cache keyed by cwd. The Map reference is const;
 * only its entries are mutated (acceptable for a cache).
 */
// oxlint-disable-next-line prefer-const -- Map is const; entries are cache mutations
const workspaceCache = new Map<string, WorkspaceInfo>();

/**
 * Return the full workspace info (manager, root, globs).
 *
 * Computes the workspace info on first access for the given cwd
 * and caches the result.
 */
export function getWorkspaceInfo(cwd: string = process.cwd()): WorkspaceInfo {
  const cached = workspaceCache.get(cwd);
  if (cached !== undefined) {
    return cached;
  }
  const info = resolveWorkspace(cwd);
  // oxlint-disable-next-line immutable-data -- cache mutation
  workspaceCache.set(cwd, info);
  return info;
}

/**
 * Return just the workspace root path.
 */
export function getWorkspaceRoot(cwd: string = process.cwd()): string {
  return getWorkspaceInfo(cwd).root;
}

/**
 * Reset the cached workspace info. Intended for testing only.
 */
export function resetWorkspaceCache(): void {
  // oxlint-disable-next-line immutable-data -- cache clear for testing
  workspaceCache.clear();
}
