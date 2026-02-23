import { groupBy } from 'es-toolkit';
import pc from 'picocolors';

import type { DiscoveredScript } from '../lib/types.ts';

/**
 * Extract the script stem from a qualified name.
 * e.g. "@scope/pkg/my-script" → "my-script"
 */
function scriptStem(qualifiedName: string): string {
  const lastSlash = qualifiedName.lastIndexOf('/');
  /* v8 ignore start -- discoverScripts always produces "pkg/stem" qualified names */
  if (lastSlash === -1) {
    return qualifiedName;
  }
  /* v8 ignore stop */
  return qualifiedName.slice(lastSlash + 1);
}

function treeConnector(isLast: boolean): string {
  if (isLast) {
    return '└── ';
  }
  return '├── ';
}

function treeChildPrefix(isLast: boolean): string {
  if (isLast) {
    return '    ';
  }
  return '│   ';
}

function formatTreeScriptLine(
  prefix: string,
  connector: string,
  stem: string,
  description: string,
  padWidth: number,
): string {
  const name = pc.cyan(stem.padEnd(padWidth));
  if (description) {
    return `${prefix}${connector}${name}${pc.dim(description)}`;
  }
  return `${prefix}${connector}${name}`;
}

/**
 * Build a directory-tree-style string from grouped scripts.
 *
 * ```
 * ├── @apps/api
 * │   ├── build          Build the project
 * │   └── test           Run tests
 * └── @libs/core
 *     └── generate       Generate types
 * ```
 */
export function buildScriptTree(
  scripts: readonly DiscoveredScript[],
  descriptions: Record<string, string>,
): string {
  const grouped = groupBy(scripts, (s) => s.packageName);
  const entries = Object.entries(grouped);
  const maxStemLen = Math.max(...scripts.map((s) => scriptStem(s.name).length));
  const padWidth = maxStemLen + 2;

  return entries
    .map(([packageName, pkgScripts], pkgIdx) => {
      const isLastPkg = pkgIdx === entries.length - 1;
      const pkgBranch = treeConnector(isLastPkg);
      const childPfx = treeChildPrefix(isLastPkg);

      const header = `${pkgBranch}${pc.bold(packageName)}`;
      const scriptLines = pkgScripts
        .map((script, scriptIdx) => {
          const isLastScript = scriptIdx === pkgScripts.length - 1;
          const scriptBranch = treeConnector(isLastScript);
          const stem = scriptStem(script.name);
          const desc = descriptions[script.path] || '';
          return formatTreeScriptLine(childPfx, scriptBranch, stem, desc, padWidth);
        })
        .join('\n');

      return `${header}\n${scriptLines}`;
    })
    .join('\n');
}
