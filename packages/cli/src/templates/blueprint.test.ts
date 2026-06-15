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
    const result = getBlueprintTemplate('clean');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("import { lauf, z } from 'laufen'");
    }
  });

  it('returns template content for copy blueprint', () => {
    const result = getBlueprintTemplate('copy');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("import { lauf, z } from 'laufen'");
    }
  });

  it('clean template includes BUILD_TARGETS constant', () => {
    const result = getBlueprintTemplate('clean');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('BUILD_TARGETS');
    }
  });

  it('copy template includes COPY_PATTERNS constant', () => {
    const result = getBlueprintTemplate('copy');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('COPY_PATTERNS');
    }
  });
});
