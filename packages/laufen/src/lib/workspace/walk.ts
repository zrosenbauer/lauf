import * as path from 'node:path';

/**
 * Maximum number of parent directories to traverse before giving up.
 */
const MAX_WALK_DEPTH = 200;

/**
 * Walk up the directory tree from `startDir`, calling `predicate` at each level.
 *
 * Returns the first directory where `predicate` returns `true`,
 * or `undefined` if the filesystem root or depth limit is reached first.
 *
 * @param startDir - Starting directory (resolved to absolute)
 * @param predicate - Called with each directory; return `true` to stop
 * @param maxDepth - Optional depth limit (default {@link MAX_WALK_DEPTH})
 * @returns The first matching directory, or `undefined`
 */
export function walkUp(
  startDir: string,
  predicate: (dir: string) => boolean,
  maxDepth: number = MAX_WALK_DEPTH,
): string | undefined {
  const step = (dir: string, prevDir: string, depth: number): string | undefined => {
    if (dir === prevDir || depth >= maxDepth) {
      return undefined;
    }
    if (predicate(dir)) {
      return dir;
    }
    return step(path.dirname(dir), dir, depth + 1);
  };

  return step(path.resolve(startDir), '', 0);
}

/**
 * Collect all ancestor directories from `startDir` up to and including `boundaryDir`.
 *
 * Returns directories in closest-first order (startDir first, boundary last).
 * Stops early if the filesystem root is reached before the boundary.
 *
 * @param startDir - Starting directory
 * @param boundaryDir - Upper boundary directory (inclusive)
 * @returns Ordered array of directory paths
 */
export function collectAncestors(startDir: string, boundaryDir: string): readonly string[] {
  const resolvedBoundary = path.resolve(boundaryDir);

  const collect = (dir: string, prevDir: string, acc: readonly string[]): readonly string[] => {
    if (dir === prevDir) {
      return acc;
    }
    const next = [...acc, dir];
    if (dir === resolvedBoundary) {
      return next;
    }
    return collect(path.dirname(dir), dir, next);
  };

  return collect(path.resolve(startDir), '', []);
}
