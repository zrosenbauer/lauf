import type { MultiSelectOptions, SelectOptions } from '@clack/prompts';
import * as p from '@clack/prompts';

import type { PromptCancelled, PromptOption, PromptResult, Prompts } from '../types.ts';

const CANCELLED: PromptCancelled = Object.freeze({ cancelled: true });

function cancelled(): PromptResult<never> {
  return [CANCELLED, null];
}

function ok<T>(value: T): PromptResult<T> {
  return [null, value];
}

/**
 * Bridge for `p.select`.
 *
 * Clack's `Option<Value>` is a conditional type that TS cannot resolve
 * when `Value` is an unresolved generic. `PromptOption<Value>` structurally
 * satisfies both branches, so the `never` assertion is safe.
 */
function clackSelect<Value>(opts: {
  readonly message: string;
  readonly options: ReadonlyArray<PromptOption<Value>>;
  readonly initialValue?: Value;
  readonly maxItems?: number;
}): Promise<Value | symbol> {
  return p.select<Value>(opts as unknown as SelectOptions<Value>);
}

/**
 * Bridge for `p.multiselect` — same conditional-type workaround as
 * {@link clackSelect}.
 */
function clackMultiselect<Value>(opts: {
  readonly message: string;
  readonly options: ReadonlyArray<PromptOption<Value>>;
  readonly initialValues?: ReadonlyArray<Value>;
  readonly maxItems?: number;
  readonly required?: boolean;
}): Promise<Value[] | symbol> {
  return p.multiselect<Value>(opts as unknown as MultiSelectOptions<Value>);
}

/**
 * Create a frozen {@link Prompts} instance.
 *
 * Each method delegates to the corresponding `@clack/prompts` function
 * and converts the cancel symbol into a {@link PromptResult} tuple so
 * callers never need to deal with raw symbols.
 */
// oxlint-disable-next-line max-lines-per-function
export function createPrompts(): Prompts {
  return Object.freeze<Prompts>({
    async text(opts) {
      const result = await p.text(opts);
      if (p.isCancel(result)) {
        return cancelled();
      }
      return ok(result);
    },

    async confirm(opts) {
      const result = await p.confirm(opts);
      if (p.isCancel(result)) {
        return cancelled();
      }
      return ok(result);
    },
    async select(opts) {
      const result = await clackSelect(opts);
      if (p.isCancel(result)) {
        return cancelled();
      }
      return ok(result);
    },

    async multiselect(opts) {
      const result = await clackMultiselect(opts);
      if (p.isCancel(result)) {
        return cancelled();
      }
      return ok(result);
    },
    async password(opts) {
      const result = await p.password(opts);
      if (p.isCancel(result)) {
        return cancelled();
      }
      return ok(result);
    },
    async path(opts) {
      const result = await p.path(opts);
      if (p.isCancel(result)) {
        return cancelled();
      }
      return ok(result);
    },
  });
}
