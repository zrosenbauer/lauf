import * as os from 'node:os';
import { pathToFileURL } from 'node:url';

import { attemptAsync } from 'es-toolkit';
import * as path from 'pathe';

import type { ArgDefs, ScriptConfig } from './types.ts';
import { safeParseJSON } from './utils/json.ts';

/**
 * Check whether a resolved script path is within the workspace root.
 */
function isWithinWorkspace(scriptPath: string, workspaceRoot: string): boolean {
  const relative = path.relative(path.resolve(workspaceRoot), path.resolve(scriptPath));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Check whether a script path is within the system temp directory.
 *
 * Anchored to `os.tmpdir()` to prevent path traversal via
 * paths that merely contain `laufen-` in an arbitrary location.
 */
function isWithinTmpDir(scriptPath: string): boolean {
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(scriptPath));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Batch metadata extractor entry point — spawned as a child process.
 *
 * Reads bundled script paths from `LAUF_SCRIPT_PATHS` (JSON string[]),
 * dynamically imports each one, and writes a JSON record of
 * `{ [path]: description }` to stdout.
 *
 * When `LAUF_WORKSPACE_ROOT` is set, only scripts within the workspace
 * root or in temp directories (bundled outputs) are imported.
 */
async function extractMetadata(): Promise<void> {
  const raw = process.env.LAUF_SCRIPT_PATHS;
  if (!raw) {
    process.stdout.write(JSON.stringify({}));
    return;
  }

  const [parseError, parsed] = safeParseJSON(raw);
  if (parseError || parsed === null || !Array.isArray(parsed)) {
    process.stdout.write(JSON.stringify({}));
    return;
  }
  const paths = parsed as string[];

  const workspaceRoot = process.env.LAUF_WORKSPACE_ROOT;

  const entries = await Promise.all(
    paths.map(async (scriptPath): Promise<readonly [string, string]> => {
      // Validate that the script path is within the workspace root
      // or is a temp directory (bundled output) to prevent importing
      // files outside the expected project boundary.
      if (
        workspaceRoot &&
        !isWithinWorkspace(scriptPath, workspaceRoot) &&
        !isWithinTmpDir(scriptPath)
      ) {
        return [scriptPath, ''];
      }

      const resolvedPath = path.resolve(scriptPath);
      const scriptFileUrl = pathToFileURL(resolvedPath).href;
      const [importError, mod] = await attemptAsync(
        () => import(scriptFileUrl) as Promise<{ default: ScriptConfig<ArgDefs> }>,
      );

      if (importError || mod === null) {
        return [scriptPath, ''];
      }

      const config = mod.default;
      if (!config || typeof config.description !== 'string') {
        return [scriptPath, ''];
      }

      return [scriptPath, config.description];
    }),
  );

  process.stdout.write(JSON.stringify(Object.fromEntries(entries)));
}

const [topError] = await attemptAsync(extractMetadata);
if (topError) {
  process.stdout.write(JSON.stringify({}));
}
