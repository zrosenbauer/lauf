# Engine API

Internal reference for the lauf engine's exported API. Covers the public surface in `src/lauf.ts` and the core types that flow through the system.

## Exports

Everything a script author touches comes from a single entry point (`src/lauf.ts`). Internally, the types are defined across `src/types.ts`, `src/lib/result.ts`, and `src/lib/config.ts`.

| Export            | Kind      | Source              | Purpose                                                               |
| ----------------- | --------- | ------------------- | --------------------------------------------------------------------- |
| `lauf()`          | Function  | `src/lauf.ts`       | Identity wrapper for script definitions; provides type inference      |
| `defineConfig()`  | Function  | `src/lauf.ts`       | Identity wrapper for `lauf.config.ts`; provides type inference        |
| `z`               | Re-export | Zod                 | Argument schema definitions without requiring a direct Zod dependency |
| `ScriptConfig`    | Type      | `src/types.ts`      | Shape of the object passed to `lauf()`                                |
| `ScriptContext`   | Type      | `src/types.ts`      | Runtime context injected into `run()`                                 |
| `LaufConfig`      | Type      | `src/lib/config.ts` | Shape of `lauf.config.ts`                                             |
| `ArgDefs`         | Type      | `src/types.ts`      | `Record<string, z.ZodType>` -- argument name to Zod schema map        |
| `InferArgs`       | Type      | `src/types.ts`      | Resolves `ArgDefs` to concrete values                                 |
| `Logger`          | Type      | `src/types.ts`      | Base logger interface (info, warn, error, success, message)           |
| `DefaultLogger`   | Type      | `src/types.ts`      | `Logger` + `newlines()` convenience method                            |
| `Spinner`         | Type      | `src/types.ts`      | start/stop/message spinner wrapper                                    |
| `Prompts`         | Type      | `src/types.ts`      | Interactive prompt methods (text, confirm, select, etc.)              |
| `PromptOption`    | Type      | `src/types.ts`      | Option shape for select/multiselect prompts                           |
| `PromptResult`    | Type      | `src/types.ts`      | `Result<T, PromptCancelled>` -- prompt return tuple                   |
| `PromptCancelled` | Type      | `src/types.ts`      | `{ cancelled: true }` sentinel                                        |

## ScriptConfig

The object passed to `lauf()`. Three fields:

| Property      | Type                                                                   | Description                                                                          |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `description` | `string`                                                               | Shown in `lauf list` and `lauf info` output                                          |
| `args`        | `T extends ArgDefs`                                                    | Keys become CLI flags; values are Zod schemas used for validation and type inference |
| `run`         | `(ctx: ScriptContext<T>) => void \| number \| Promise<void \| number>` | Entry point; `void`/`0` = success, non-zero = failure exit code                      |

## ScriptContext

Injected into `run()` by the executor. All properties are readonly.

| Property     | Type            | Where it comes from                                              |
| ------------ | --------------- | ---------------------------------------------------------------- |
| `args`       | `InferArgs<T>`  | Parsed from CLI flags, validated against the script's Zod schema |
| `root`       | `string`        | Workspace root detected via `pnpm-workspace.yaml`                |
| `packageDir` | `string`        | Directory of the package containing this script                  |
| `name`       | `string`        | Qualified name, e.g. `@apps/api/generate-types`                  |
| `logger`     | `DefaultLogger` | Custom logger from config, or built-in clack logger              |
| `spinner`    | `Spinner`       | Clack spinner (or noop if `spinner: false` in config)            |
| `prompts`    | `Prompts`       | Clack prompt wrappers that return `PromptResult` tuples          |

## LaufConfig

Shape of `lauf.config.ts`. All fields are optional with sensible defaults.

| Property  | Type            | Default               | Description                                                  |
| --------- | --------------- | --------------------- | ------------------------------------------------------------ |
| `scripts` | `string[]`      | `['scripts/*.ts']`    | Glob patterns for script discovery, relative to each package |
| `logger`  | `DefaultLogger` | Built-in clack logger | Override the logger injected into `ScriptContext`            |
| `spinner` | `boolean`       | `true`                | Toggle the progress spinner                                  |

## Result Types

The engine uses `Result` tuples instead of exceptions. These are internal to the codebase (not exported to script authors) but are central to how every handler and lib function communicates success/failure.

| Type               | Definition                                              | Used by                                      |
| ------------------ | ------------------------------------------------------- | -------------------------------------------- |
| `Result<T, E>`     | `readonly [E, null] \| readonly [null, T]`              | All lib functions, config loading, discovery |
| `HandlerResult<T>` | `Result<T, HandlerError>`                               | Every CLI handler                            |
| `HandlerError`     | `{ message: string, hint?: string, exitCode?: number }` | `fail()` constructor                         |

Constructors in `src/lib/result.ts`:

- `ok()` / `ok(value)` -- create a success tuple
- `fail({ message, hint?, exitCode? })` -- create a failure tuple

## References

- [Architecture](../concepts/architecture.md)
- [CLI](../concepts/cli.md)
- [Errors](../standards/typescript/errors.md)
- [Types](../standards/typescript/types.md)
