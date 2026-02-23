import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { fail, ok } from './result.ts';

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
  },
}));

import { defineHandler } from './handler.ts';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('defineHandler with plain function', () => {
  it('does not exit on success', async () => {
    const handler = defineHandler(() => ok());
    await handler({} as never);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('exits with code 1 on failure without exit code', async () => {
    const handler = defineHandler(() => fail({ message: 'failed' }));
    await handler({} as never);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('exits with code 0 for exitCode 0', async () => {
    const handler = defineHandler(() => fail({ message: 'cancelled', exitCode: 0 }));
    await handler({} as never);
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('logs message via p.log.info when exitCode is 0 and message is present', async () => {
    const handler = defineHandler(() => fail({ message: 'user cancelled', exitCode: 0 }));
    await handler({} as never);
    expect(p.log.info).toHaveBeenCalledWith('user cancelled');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('does not log message when exitCode is 0 and message is empty', async () => {
    const handler = defineHandler(() => fail({ message: '', exitCode: 0 }));
    await handler({} as never);
    expect(p.log.info).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('exits with custom exit code', async () => {
    const handler = defineHandler(() => fail({ message: 'error', exitCode: 2 }));
    await handler({} as never);
    expect(process.exit).toHaveBeenCalledWith(2);
  });

  it('logs error message on failure', async () => {
    const handler = defineHandler(() => fail({ message: 'something broke' }));
    await handler({} as never);
    expect(p.log.error).toHaveBeenCalledWith('something broke');
  });

  it('logs hint when provided', async () => {
    const handler = defineHandler(() => fail({ message: 'err', hint: 'try this' }));
    await handler({} as never);
    expect(p.log.message).toHaveBeenCalled();
  });

  it('does not log hint when not provided', async () => {
    const handler = defineHandler(() => fail({ message: 'err' }));
    await handler({} as never);
    // message is only called for hint, error is called for the error message
    expect(p.log.message).not.toHaveBeenCalled();
  });

  it('handles async handler returning success', async () => {
    const handler = defineHandler(async () => ok());
    await handler({} as never);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('handles async handler returning failure', async () => {
    const handler = defineHandler(async () => fail({ message: 'async err' }));
    await handler({} as never);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(p.log.error).toHaveBeenCalledWith('async err');
  });
});

describe('defineHandler with HandlerConfig', () => {
  it('validates context and calls handler on success', async () => {
    const handlerFn = vi.fn(() => ok());
    const handler = defineHandler({
      parameters: z.object({ name: z.string() }),
      handler: handlerFn,
    });

    await handler({ name: 'test' });
    expect(handlerFn).toHaveBeenCalledWith({ name: 'test' });
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('exits with code 1 on validation failure', async () => {
    const handlerFn = vi.fn(() => ok());
    const handler = defineHandler({
      parameters: z.object({ name: z.string() }),
      handler: handlerFn,
    });

    await handler({ name: 123 });
    expect(handlerFn).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('logs formatted arg errors on validation failure', async () => {
    const handler = defineHandler({
      parameters: z.object({ name: z.string() }),
      handler: () => ok(),
    });

    await handler({ name: 123 });
    expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Invalid arguments'));
  });

  it('handles async handler in config', async () => {
    const handler = defineHandler({
      parameters: z.object({ value: z.number() }),
      handler: async (ctx) => {
        if (ctx.value > 10) {
          return fail({ message: 'too big' });
        }
        return ok();
      },
    });

    await handler({ value: 5 });
    expect(process.exit).not.toHaveBeenCalled();

    await handler({ value: 20 });
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('handles handler returning failure', async () => {
    const handler = defineHandler({
      parameters: z.object({ name: z.string() }),
      handler: () => fail({ message: 'handler failed', exitCode: 3 }),
    });

    await handler({ name: 'test' });
    expect(process.exit).toHaveBeenCalledWith(3);
    expect(p.log.error).toHaveBeenCalledWith('handler failed');
  });

  it('treats config with non-function handler as plain function', async () => {
    const notReallyConfig = { parameters: z.object({}), handler: 'not-a-fn' };
    // defineHandler should treat this as a plain function (the isHandlerConfig
    // check returns false because handler is not a function), so calling it
    // will attempt to invoke notReallyConfig as a function and fail.
    const handler = defineHandler(notReallyConfig as never);
    // The handler is wrapped as a plain function path -- calling it will throw
    // because notReallyConfig itself is not callable.
    await expect(handler({} as never)).rejects.toThrow(TypeError);
  });

  it('treats non-object value as plain function', async () => {
    const fn = () => ok();
    const handler = defineHandler(fn);
    await handler({} as never);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('treats object missing handler key as plain function', async () => {
    const objWithoutHandler = { parameters: z.object({}) };
    // Missing 'handler' key fails isHandlerConfig at the key-existence check,
    // so defineHandler treats it as a plain function (which is not callable).
    const handler = defineHandler(objWithoutHandler as never);
    await expect(handler({} as never)).rejects.toThrow(TypeError);
  });
});
