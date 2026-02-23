import * as p from '@clack/prompts';

import type { DefaultLogger } from '../../types.ts';

/**
 * Create a frozen {@link DefaultLogger} instance.
 *
 * Each method delegates to the corresponding `@clack/prompts` `log.*`
 * function so that script output is consistently styled with the
 * clack bar decoration.
 */
export function createLogger(): DefaultLogger {
  return Object.freeze<DefaultLogger>({
    info(message: string): void {
      p.log.info(message);
    },
    warn(message: string): void {
      p.log.warn(message);
    },
    error(message: string): void {
      p.log.error(message);
    },
    success(message: string): void {
      p.log.success(message);
    },
    message(message: string): void {
      p.log.message(message);
    },
    /**
     * Print blank lines to the terminal.
     * Uses `console.log` instead of clack so no bar character is prepended.
     */
    newlines(n = 1): void {
      const count = Math.max(0, n);
      Array.from({ length: count }, () => console.log());
    },
  });
}
