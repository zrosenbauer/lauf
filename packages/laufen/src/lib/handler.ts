import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { z } from 'zod';

import { formatArgErrors } from '../utils/cli.ts';
import type { HandlerResult } from './result.ts';

/**
 * Object-form handler configuration that pairs a Zod schema for the
 * Clerc context with the handler function. The context is `safeParse`d
 * at runtime; validation failures exit cleanly with formatted errors.
 */
export interface HandlerConfig<S extends z.ZodType> {
  readonly parameters: S;
  readonly handler: (ctx: z.infer<S>) => HandlerResult | Promise<HandlerResult>;
}

/**
 * Define a Clerc-compatible command handler from a function that returns
 * `HandlerResult`. Centralizes error display and `process.exit` so
 * individual handlers never need to deal with side-effectful exits.
 */
export function defineHandler<Ctx>(
  fn: (ctx: Ctx) => HandlerResult | Promise<HandlerResult>,
): (ctx: Ctx) => Promise<void>;

/**
 * Define a Clerc-compatible command handler from a {@link HandlerConfig}
 * object. The Clerc context is validated against the provided Zod schema
 * before the handler is called.
 */
export function defineHandler<S extends z.ZodType>(
  config: HandlerConfig<S>,
): (ctx: unknown) => Promise<void>;

export function defineHandler(
  fnOrConfig: ((ctx: never) => HandlerResult | Promise<HandlerResult>) | HandlerConfig<z.ZodType>,
): (ctx: never) => Promise<void> {
  if (isHandlerConfig(fnOrConfig)) {
    return async (ctx: unknown): Promise<void> => {
      const parsed = fnOrConfig.parameters.safeParse(ctx);

      if (!parsed.success) {
        p.log.error(formatArgErrors(parsed.error.issues));
        process.exit(1);
        return;
      }

      await handleResult(fnOrConfig.handler(parsed.data));
    };
  }

  const fn = fnOrConfig;
  return async (ctx: never): Promise<void> => {
    await handleResult(fn(ctx));
  };
}

/**
 * Discriminate a plain handler function from a {@link HandlerConfig} object.
 */
function isHandlerConfig(value: unknown): value is HandlerConfig<z.ZodType> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('parameters' in value) || !('handler' in value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.handler !== 'function') {
    return false;
  }
  return (
    typeof obj.parameters === 'object' && obj.parameters !== null && 'safeParse' in obj.parameters
  );
}

/**
 * Shared exit logic for resolved handler results.
 * Displays errors via `@clack/prompts` and calls `process.exit`.
 */
async function handleResult(result: HandlerResult | Promise<HandlerResult>): Promise<void> {
  const [error] = await Promise.resolve(result);

  if (error === null) {
    return;
  }

  if (error.exitCode === 0) {
    if (error.message) {
      p.log.info(error.message);
    }
    process.exit(0);
    return;
  }

  p.log.error(error.message);

  if (error.hint) {
    p.log.message(pc.dim(error.hint));
  }

  process.exit(error.exitCode ?? 1);
}
