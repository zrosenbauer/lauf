import * as path from 'pathe';

import type { DiscoveredScript } from '../types.ts';
import { canonicalize } from './canonical.ts';

/**
 * Dedupe discovered scripts by canonical path, keeping the entry whose
 * `packageDir` is the deepest (most-specific) workspace that owns the file.
 *
 * Prevents a parent workspace's broad glob (e.g. `**\/*.lauf.ts`) from
 * emitting a nested-workspace script under two qualified names.
 *
 * Single pass: one `canonicalize()` per side, then a sort + `Object.fromEntries`
 * last-write-wins keyed by canonical path.
 */
export function dedupeByDeepestOwner(
  scripts: readonly DiscoveredScript[],
): readonly DiscoveredScript[] {
  const ranked = scripts.map((script) => {
    const canonicalPath = canonicalize(script.path);
    const canonicalDir = canonicalize(script.packageDir);
    return {
      script,
      canonicalPath,
      depth: canonicalDir.split(path.sep).length,
    };
  });

  const byCanonicalPath = Object.fromEntries(
    ranked
      .toSorted((a, b) => a.depth - b.depth)
      .map(({ canonicalPath, script }) => [canonicalPath, script] as const),
  );

  return Object.values(byCanonicalPath);
}
