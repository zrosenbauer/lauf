import * as p from '@clack/prompts';

import type { Spinner } from '../types.ts';

const noop = (): void => {};

/**
 * Create a frozen no-op {@link Spinner} instance.
 *
 * All methods silently do nothing. Use this when spinner output is
 * disabled so callers don't need conditional checks.
 */
export function createNoopSpinner(): Spinner {
  return Object.freeze<Spinner>({
    start: noop,
    stop: noop,
    message: noop,
  });
}

/**
 * Create a frozen {@link Spinner} instance.
 *
 * Wraps `@clack/prompts` `spinner()` and delegates `start`, `stop`,
 * and `message` to the underlying spinner handle.
 */
export function createSpinner(): Spinner {
  const s = p.spinner();

  return Object.freeze<Spinner>({
    /**
     * Start the spinner with an optional message.
     */
    start(message?: string): void {
      s.start(message);
    },

    /**
     * Stop the spinner with an optional final message.
     */
    stop(message?: string): void {
      s.stop(message);
    },

    /**
     * Update the spinner's message while it is running.
     */
    message(message?: string): void {
      s.message(message);
    },
  });
}
