import * as fs from 'node:fs';

import { attempt, isErr } from 'massaman/control';
import * as path from 'pathe';

import { safeParseJSON } from '../utils/json.ts';

/**
 * Read the `name` field from a directory's `package.json`.
 * Falls back to the directory basename when the file is missing,
 * unparseable, or has no `name`.
 */
export function readWorkspaceName(dir: string): string {
  const pkgJsonPath = path.join(dir, 'package.json');
  const read = attempt(() => fs.readFileSync(pkgJsonPath, 'utf-8'));
  if (isErr(read)) {
    return path.basename(dir);
  }

  const parsed = safeParseJSON(read.value);
  if (isErr(parsed)) {
    return path.basename(dir);
  }

  const pkg = parsed.value;
  if (typeof pkg === 'object' && pkg !== null && 'name' in pkg && typeof pkg.name === 'string') {
    return pkg.name;
  }

  return path.basename(dir);
}
