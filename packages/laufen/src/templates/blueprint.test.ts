import { describe, expect, it } from 'vitest';

import { BLUEPRINTS, getBlueprintTemplate, isBlueprintName } from './blueprint.ts';

describe('isBlueprintName', () => {
  it('returns true for valid blueprint names', () => {
    expect(isBlueprintName('clean')).toBe(true);
    expect(isBlueprintName('copy')).toBe(true);
  });

  it('returns false for unknown names', () => {
    expect(isBlueprintName('unknown')).toBe(false);
    expect(isBlueprintName('')).toBe(false);
  });

  it('covers all entries in BLUEPRINTS', () => {
    BLUEPRINTS.forEach((name) => {
      expect(isBlueprintName(name)).toBe(true);
    });
  });
});

describe('getBlueprintTemplate', () => {
  it('returns template content for clean blueprint', () => {
    const [error, content] = getBlueprintTemplate('clean');

    expect(error).toBeNull();
    expect(content).toContain("import { lauf, z } from 'laufen'");
  });

  it('returns template content for copy blueprint', () => {
    const [error, content] = getBlueprintTemplate('copy');

    expect(error).toBeNull();
    expect(content).toContain("import { lauf, z } from 'laufen'");
  });

  it('returns a result tuple on success', () => {
    const result = getBlueprintTemplate('clean');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeNull();
  });

  it('clean template includes BUILD_TARGETS constant', () => {
    const [, content] = getBlueprintTemplate('clean');

    expect(content).toContain('BUILD_TARGETS');
  });

  it('copy template includes COPY_PATTERNS constant', () => {
    const [, content] = getBlueprintTemplate('copy');

    expect(content).toContain('COPY_PATTERNS');
  });
});
