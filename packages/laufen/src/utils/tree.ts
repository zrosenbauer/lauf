import { groupBy } from 'es-toolkit';
import pc from 'picocolors';

import { ROOT_PACKAGE_NAME } from '../lib/discovery.ts';
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
 * Render a list of packages (non-root) as tree branches.
 *
 * ```
 * ├── @apps/api
 * │   ├── build          Build the project
 * │   └── test           Run tests
 * └── @libs/core
 *     └── generate       Generate types
 * ```
 */
function formatPackageBranches(
  entries: readonly (readonly [string, DiscoveredScript[]])[],
  descriptions: Record<string, string>,
  padWidth: number,
): string {
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

/**
 * Render root scripts as top-level tree children (no indentation prefix).
 */
function formatRootScriptLines(
  rootScripts: readonly DiscoveredScript[],
  descriptions: Record<string, string>,
  padWidth: number,
  hasPackages: boolean,
): string {
  return rootScripts
    .map((script, idx) => {
      const isLast = idx === rootScripts.length - 1 && !hasPackages;
      const connector = treeConnector(isLast);
      const stem = scriptStem(script.name);
      const desc = descriptions[script.path] || '';
      return formatTreeScriptLine('', connector, stem, desc, padWidth);
    })
    .join('\n');
}

/**
 * Build a directory-tree-style string from grouped scripts.
 *
 * When root workspace scripts are present, `<root>` is rendered as
 * the top-level heading with its scripts and other packages nested
 * beneath it:
 *
 * ```
 * <root>
 * ├── script-a            Description A
 * ├── script-b            Description B
 * ├── @apps/api
 * │   ├── build           Build the project
 * │   └── test            Run tests
 * └── @libs/core
 *     └── generate        Generate types
 * ```
 *
 * When there are no root scripts, packages are rendered as a flat tree:
 *
 * ```
 * ├── @apps/api
 * │   ├── build           Build the project
 * │   └── test            Run tests
 * └── @libs/core
 *     └── generate        Generate types
 * ```
 */
export function buildScriptTree(
  scripts: readonly DiscoveredScript[],
  descriptions: Record<string, string>,
): string {
  const grouped = groupBy(scripts, (s) => s.packageName);
  const rootScripts = grouped[ROOT_PACKAGE_NAME] || [];
  const packageEntries = Object.entries(grouped).filter(([name]) => name !== ROOT_PACKAGE_NAME);
  const maxStemLen = Math.max(...scripts.map((s) => scriptStem(s.name).length));
  const padWidth = maxStemLen + 2;

  if (rootScripts.length === 0) {
    return formatPackageBranches(packageEntries, descriptions, padWidth);
  }

  const header = pc.bold(ROOT_PACKAGE_NAME);
  const scriptLines = formatRootScriptLines(
    rootScripts,
    descriptions,
    padWidth,
    packageEntries.length > 0,
  );

  if (packageEntries.length === 0) {
    return `${header}\n${scriptLines}`;
  }

  const packageLines = formatPackageBranches(packageEntries, descriptions, padWidth);
  return `${header}\n${scriptLines}\n${packageLines}`;
}
