/**
 * Strip characters not in `[a-zA-Z0-9_-]` from a script name
 * to prevent template injection.
 *
 * @param name - Raw name input
 * @returns Sanitized name safe for template interpolation
 */
export function sanitizeName(name: string): string {
  return name.replaceAll(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Escape characters that could break a single-quoted string literal
 * (backslash and single quote).
 *
 * @param value - String to escape
 * @returns Escaped string safe for single-quoted template contexts
 */
function escapeStringLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

/**
 * Escape characters that could break a template literal (backtick and `${`).
 *
 * @param value - String to escape
 * @returns Escaped string safe for backtick template contexts
 */
function escapeTemplateLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
}

/**
 * Template for a new lauf script — written by `lauf create <name>`.
 *
 * @param name - Script name used in the template description
 * @returns Template string for the script file
 */
export function scriptTemplate(name: string): string {
  const safeName = sanitizeName(name);
  const singleQuoteSafe = escapeStringLiteral(safeName);
  const templateSafe = escapeTemplateLiteral(safeName);

  return `import { lauf, z } from 'laufen'

export default lauf({
  description: '${singleQuoteSafe} script',
  args: {
    verbose: z.boolean().default(false).describe('Enable verbose logging'),
  },
  async run(ctx) {
    if (ctx.args.verbose) {
      ctx.logger.info(\`Running ${templateSafe} in \${ctx.packageDir}\`)
    }

    // TODO: implement ${safeName}
    ctx.logger.success('Hello from ${singleQuoteSafe}!')
  },
})
`;
}
