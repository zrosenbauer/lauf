import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { FsHelpers } from './fs-types.ts';

const createReadFile =
  (resolvePath: (path: string) => string) =>
  (filePath: string, encoding: BufferEncoding = 'utf-8') => {
    const resolved = resolvePath(filePath);
    if (encoding) {
      return readFile(resolved, encoding);
    }
    return readFile(resolved);
  };

const createWriteFile =
  (resolvePath: (path: string) => string) => async (filePath: string, data: string | Buffer) => {
    const resolved = resolvePath(filePath);
    await mkdir(dirname(resolved), { recursive: true });
    if (typeof data === 'string') {
      await writeFile(resolved, data, 'utf-8');
    } else {
      await writeFile(resolved, data);
    }
  };

const createCopyFile =
  (resolvePath: (path: string) => string) => async (src: string, dest: string) => {
    const resolvedSrc = resolvePath(src);
    const resolvedDest = resolvePath(dest);
    await copyFile(resolvedSrc, resolvedDest);
  };

const createMkdir = (resolvePath: (path: string) => string) => async (dirPath: string) => {
  const resolved = resolvePath(dirPath);
  await mkdir(resolved, { recursive: true });
};

const createRm = (resolvePath: (path: string) => string) => async (targetPath: string) => {
  const resolved = resolvePath(targetPath);
  await rm(resolved, { recursive: true, force: true });
};

const createExists = (resolvePath: (path: string) => string) => async (filePath: string) => {
  const resolved = resolvePath(filePath);
  const result = await stat(resolved)
    .then(() => true)
    .catch(() => false);
  return result;
};

const createStat = (resolvePath: (path: string) => string) => async (filePath: string) => {
  const resolved = resolvePath(filePath);
  const stats = await stat(resolved);
  return {
    isFile: () => stats.isFile(),
    isDirectory: () => stats.isDirectory(),
    size: stats.size,
    mtime: stats.mtime,
  };
};

/**
 * Create filesystem helpers scoped to a package directory.
 *
 * All paths are resolved relative to the provided package directory.
 */
export function createFsHelpers(packageDir: string): FsHelpers {
  const resolvePath = (filePath: string) => resolve(packageDir, filePath);

  return {
    readFile: createReadFile(resolvePath),
    writeFile: createWriteFile(resolvePath),
    copyFile: createCopyFile(resolvePath),
    mkdir: createMkdir(resolvePath),
    rm: createRm(resolvePath),
    exists: createExists(resolvePath),
    stat: createStat(resolvePath),
  };
}
