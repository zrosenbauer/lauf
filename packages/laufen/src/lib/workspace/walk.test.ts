import { describe, expect, it } from 'vitest';

import { collectAncestors, walkUp } from './walk.ts';

describe('walkUp', () => {
  it('returns startDir when predicate matches immediately', () => {
    const result = walkUp('/projects/my-app', () => true);
    expect(result).toBe('/projects/my-app');
  });

  it('walks up to find matching directory', () => {
    const result = walkUp('/projects/my-app/src/lib', (dir) => dir === '/projects/my-app');
    expect(result).toBe('/projects/my-app');
  });

  it('returns undefined when predicate never matches', () => {
    const result = walkUp('/', () => false);
    expect(result).toBeUndefined();
  });

  it('returns undefined when max depth is reached', () => {
    const result = walkUp('/a/b/c/d/e', () => false, 2);
    expect(result).toBeUndefined();
  });

  it('respects custom max depth', () => {
    const result = walkUp('/a/b/c', (dir) => dir === '/a', 1);
    expect(result).toBeUndefined();
  });

  it('walks up correctly through nested directories', () => {
    const visited: string[] = [];
    walkUp(
      '/a/b/c',
      (dir) => {
        // oxlint-disable-next-line immutable-data
        visited.push(dir);
        return false;
      },
      10,
    );
    expect(visited[0]).toBe('/a/b/c');
    expect(visited[1]).toBe('/a/b');
    expect(visited[2]).toBe('/a');
    expect(visited[3]).toBe('/');
  });
});

describe('collectAncestors', () => {
  it('collects single directory when start equals boundary', () => {
    const result = collectAncestors('/projects', '/projects');
    expect(result).toEqual(['/projects']);
  });

  it('collects chain of directories from start to boundary', () => {
    const result = collectAncestors('/projects/my-app/src', '/projects');
    expect(result).toEqual(['/projects/my-app/src', '/projects/my-app', '/projects']);
  });

  it('stops at filesystem root', () => {
    const result = collectAncestors('/', '/some/boundary');
    expect(result).toEqual(['/']);
  });
});
