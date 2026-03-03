# CLI

Overview of the CLI system -- commands, the handler pattern, and how errors flow from handlers to the terminal.

## Overview

lauf uses [Clerc](https://github.com/mrozio13pl/clerc) for command routing and [`@clack/prompts`](https://www.clack.cc) for styled terminal output. The CLI entry point is `src/index.ts`, which registers all commands and attaches a global error handler. Each command is implemented as a handler in `src/handlers/`.

## Commands

| Command         | Description                                     | Parameters                                | Flags                                                                                     |
| --------------- | ----------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `init`          | Write `lauf.config.ts` in the current directory | --                                        | --                                                                                        |
| `list`          | Discover and display all scripts as a tree      | --                                        | `--all` / `-a` (include nested configs), `--filter` / `-f` (filter packages by name glob) |
| `info [script]` | Show details and help for a script              | `[script]` (optional, prompts if omitted) | --                                                                                        |
| `run [script]`  | Execute a script in a child process             | `[script]` (optional, prompts if omitted) | --                                                                                        |
| `create [name]` | Scaffold a new script file from a template      | `[name]` (optional, prompts if omitted)   | `--dir` (target directory relative to root)                                               |

Commands with optional parameters prompt the user interactively when the parameter is omitted.

## Handler Pattern

Every command handler is wrapped with `defineHandler()` from `src/lib/handler.ts`. This factory enforces the rule that handlers never call `process.exit` or throw -- they return data, and a single shared function handles side effects.

### Two Overloads

**Plain function** -- accepts the Clerc context, returns `HandlerResult`:

```ts
export default defineHandler((ctx) => {
  // ctx is the raw Clerc context
  return ok();
});
```

**Config object** -- pairs a Zod schema with a handler function. The Clerc context is `safeParse`d against the schema before the handler runs:

```ts
const params = z.object({
  parameters: z.object({ script: z.string().optional() }),
});

export default defineHandler({
  parameters: params,
  handler: async (ctx) => {
    // ctx is validated and fully typed
    return ok();
  },
});
```

### Return Values

Handlers return `HandlerResult` tuples via `ok()` and `fail()`:

```ts
// Success
return ok();

// Failure with message
return fail({ message: 'Config not found' });

// Failure with hint and custom exit code
return fail({
  message: 'Script not found',
  hint: 'Run "lauf list" to see available scripts',
  exitCode: 2,
});
```

## Error Flow

Errors propagate from handlers to the terminal through a single path:

```
Handler returns fail({ message, hint?, exitCode? })
  -> handleResult() receives the tuple
  -> Logs error via p.log.error(message)
  -> Logs hint via p.log.message(dim(hint)) if present
  -> Calls process.exit(exitCode ?? 1)
```

The global Clerc error handler (`errorHandler` in `src/index.ts`) catches unexpected errors that escape the handler pattern -- parse failures, missing commands, etc. It logs the error and exits with code 1.

This design means:

- No handler ever calls `process.exit` directly
- No handler ever throws
- All error formatting is centralized in `handleResult()`
- Exit codes are explicit and testable

## Adding a Command

See the [Adding a CLI Command](../guides/adding-a-cli-command.md) guide for a step-by-step walkthrough.

## References

- [Architecture](./architecture.md)
- [Errors](../standards/typescript/errors.md)
- [Design Patterns](../standards/typescript/design-patterns.md)
