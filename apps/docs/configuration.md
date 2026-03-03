# Configuration

Lauf requires a config file at the workspace root. Run `lauf init` to scaffold one, or create it manually.

## Config File

Lauf recognizes the following config file names:

- `lauf.config.ts`
- `laufen.config.ts`

Use `defineConfig()` for type inference:

```ts
import { defineConfig } from 'laufen';

export default defineConfig({
  scripts: ['scripts/*.ts'],
});
```

## Options

| Property  | Type                              | Default                 | Description                                                     |
| --------- | --------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `scripts` | `string[]`                        | `['scripts/*.lauf.ts']` | Glob patterns to discover scripts per package                   |
| `logger`  | `Logger`                          | built-in                | Custom logger implementation                                    |
| `spinner` | `boolean`                         | `true`                  | Enable or disable the progress spinner globally                 |
| `sandbox` | `boolean`                         | `true`                  | Controls base environment: minimal sandbox or full inherit      |
| `env`     | `Record<string, string> \| EnvFn` | `{}`                    | Environment variables passed to all scripts (static or dynamic) |

### `scripts`

An array of glob patterns relative to each workspace package. Lauf scans every package for files matching these patterns.

```ts
export default defineConfig({
  scripts: ['scripts/*.ts', 'tools/**/*.ts'],
});
```

### `logger`

An optional custom logger. When omitted, Lauf uses a built-in logger with styled terminal output.

The logger must implement these methods:

- `info(message: string): void`
- `warn(message: string): void`
- `error(message: string): void`
- `success(message: string): void`
- `message(message: string): void`
- `newlines(n?: number): void`

### `spinner`

A boolean that enables or disables the global spinner. Defaults to `true`. When `false`, spinner calls in your scripts become no-ops.

### `sandbox`

Controls the base environment for child processes. Defaults to `true`.

- **`true`** (default): Scripts start with a minimal environment containing only `PATH`, `HOME`, `TERM`, `SHELL`, `USER`, `LANG`, and `TMPDIR`. This prevents secrets and ambient variables from leaking into scripts.
- **`false`**: Scripts inherit the full parent `process.env`. Use this if your scripts depend on ambient environment variables.

```ts
export default defineConfig({
  sandbox: false, // opt into full environment inheritance
});
```

### `env`

Environment variables passed to all scripts. Accepts a static record or an async function that receives an `EnvContext` and returns a record.

Static env values override base environment variables but are overridden by script-level `env` and CLI `--env` flags.

```ts
// Static record
export default defineConfig({
  env: {
    NODE_ENV: 'development',
    LOG_LEVEL: 'debug',
  },
});

// Dynamic function
export default defineConfig({
  env: async (ctx) => ({
    ...(await dotenv('.env', '.env.local')(ctx)),
    SCRIPT: ctx.script.name,
  }),
});
```

Use the `dotenv()` helper (exported from `laufen`) to load `.env` files. `dotenv()` returns an `EnvFn`, so it can be used directly:

```ts
import { defineConfig, dotenv } from 'laufen';

// Single .env file (default)
export default defineConfig({
  env: dotenv(),
});

// Multiple files (later files overwrite earlier ones)
export default defineConfig({
  env: dotenv('.env', '.env.local'),
});
```

Use the `infisical()` helper to load secrets from [Infisical](https://infisical.com). Requires the Infisical CLI to be installed and authenticated:

```ts
import { defineConfig, infisical } from 'laufen';

// Single path
export default defineConfig({
  env: infisical({ path: '/', env: 'dev', projectId: 'abc' }),
});

// Multiple paths (later paths overwrite earlier ones)
export default defineConfig({
  env: infisical({ path: '/dev' }, { path: '/shared' }),
});
```

Compose multiple sources with an async function:

```ts
import { defineConfig, dotenv, infisical } from 'laufen';

export default defineConfig({
  env: async (ctx) => ({
    ...(await dotenv('.env')(ctx)),
    ...(await infisical({ path: '/' })(ctx)),
    CUSTOM: 'value',
  }),
});
```

**Merge priority** (later overwrites earlier): base env (sandbox) < config `env` < script `env` < CLI `--env`

## Config Loading Behavior

Lauf searches upward from the current directory for the nearest config file. Your settings are merged with the built-in defaults and validated at load time.

If no config file is found, Lauf falls back to the default values. If validation fails, a warning is printed and defaults are used.

## `defineConfig`

```ts
import { defineConfig } from 'laufen';
```

An identity function that provides TypeScript type inference for your config. It accepts a config object and returns it unchanged.
