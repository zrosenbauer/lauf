import * as p from '@clack/prompts';

import { fail, ok } from '../lib/result.ts';
import type { HandlerResult } from '../lib/result.ts';
import type { DiscoveredScript } from '../lib/types.ts';

/**
 * Present an interactive select menu of discovered scripts.
 *
 * @param scripts - Available scripts to choose from
 * @returns The selected script, or a fail result on cancel/empty
 */
export async function promptForScript(
  scripts: readonly DiscoveredScript[],
): Promise<HandlerResult<DiscoveredScript>> {
  if (scripts.length === 0) {
    return fail({
      message: 'No scripts found',
      hint: 'Run `lauf init` to get started.',
    });
  }

  const selected = await p.select({
    message: 'Select a script',
    options: scripts.map((s) => ({ value: s, label: s.name })),
  });

  if (p.isCancel(selected)) {
    p.cancel('Cancelled');
    return fail({ message: 'Cancelled', exitCode: 0 });
  }

  return ok(selected);
}

/**
 * Present an interactive text input prompt.
 *
 * @param message - Prompt message to display
 * @param placeholder - Optional placeholder text
 * @returns The entered string, or a fail result on cancel
 */
export async function promptForText(
  message: string,
  placeholder?: string,
): Promise<HandlerResult<string>> {
  const value = await p.text({
    message,
    placeholder,
  });

  if (p.isCancel(value)) {
    p.cancel('Cancelled');
    return fail({ message: 'Cancelled', exitCode: 0 });
  }

  return ok(value);
}
