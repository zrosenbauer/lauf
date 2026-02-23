import { describe, expect, it } from 'vitest';

import { sanitizeName, scriptTemplate } from './script.ts';

describe('sanitizeName', () => {
  it('preserves alphanumeric characters', () => {
    expect(sanitizeName('myScript123')).toBe('myScript123');
  });

  it('preserves hyphens and underscores', () => {
    expect(sanitizeName('my-script_name')).toBe('my-script_name');
  });

  it('strips single quotes', () => {
    expect(sanitizeName("it's")).toBe('its');
  });

  it('strips backticks', () => {
    expect(sanitizeName('name`injection')).toBe('nameinjection');
  });

  it('strips dollar-brace sequences', () => {
    expect(sanitizeName('name${evil}')).toBe('nameevil');
  });

  it('strips spaces and special characters', () => {
    expect(sanitizeName('my script!@#$%^&*()')).toBe('myscript');
  });

  it('returns empty string for all-invalid input', () => {
    expect(sanitizeName('!@#$%')).toBe('');
  });

  it('strips path traversal characters', () => {
    expect(sanitizeName('../../../etc/passwd')).toBe('etcpasswd');
  });
});

describe('scriptTemplate', () => {
  it('imports lauf and z from laufen', () => {
    const result = scriptTemplate('test');
    expect(result).toContain("import { lauf, z } from 'laufen'");
  });

  it('includes export default with lauf()', () => {
    const result = scriptTemplate('test');
    expect(result).toContain('export default lauf(');
  });

  it('includes description with script name', () => {
    const result = scriptTemplate('my-script');
    expect(result).toContain("description: 'my-script script'");
  });

  it('includes verbose boolean arg with default', () => {
    const result = scriptTemplate('test');
    expect(result).toContain('verbose: z.boolean().default(false)');
  });

  it('includes async run function', () => {
    const result = scriptTemplate('test');
    expect(result).toContain('async run(ctx)');
  });

  it('includes TODO comment with script name', () => {
    const result = scriptTemplate('deploy');
    expect(result).toContain('TODO: implement deploy');
  });

  it('includes logger.success call with script name', () => {
    const result = scriptTemplate('greet');
    expect(result).toContain('Hello from greet!');
  });

  it('ends with a newline', () => {
    const result = scriptTemplate('test');
    expect(result.endsWith('\n')).toBe(true);
  });

  it('uses the name in multiple places', () => {
    const result = scriptTemplate('build');
    const nameOccurrences = result.split('build').length - 1;
    expect(nameOccurrences).toBeGreaterThanOrEqual(3);
  });

  it('sanitizes names with special characters', () => {
    const result = scriptTemplate("name'; process.exit(1); //");
    expect(result).not.toContain("'; process.exit(1); //");
    expect(result).toContain("description: 'nameprocessexit1 script'");
  });

  it('sanitizes names with template literal injection', () => {
    const result = scriptTemplate('name${process.exit(1)}');
    expect(result).not.toContain('${process.exit(1)}');
    expect(result).toContain('nameprocessexit1');
  });

  it('sanitizes names with backtick injection', () => {
    const result = scriptTemplate('name`; rm -rf /; echo `');
    // The backticks in the name are stripped; the template output
    // still contains backticks from the ES6 template literal syntax,
    // which is expected.
    expect(result).not.toContain('name`');
    expect(result).toContain('namerm-rfecho');
  });
});
