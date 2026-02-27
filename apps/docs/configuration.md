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

| Property  | Type                     | Default            | Description                                                  |
| --------- | ------------------------ | ------------------ | ------------------------------------------------------------ |
| `scripts` | `string[]`               | `['scripts/*.ts']` | Glob patterns to discover scripts per package                |
| `logger`  | `Logger`                 | built-in           | Custom logger implementation                                 |
| `spinner` | `boolean`                | `true`             | Enable or disable the progress spinner globally              |
| `envFile` | `string \| string[]`     | `[]`               | Path(s) to `.env` files to load                              |
| `env`     | `Record<string, string>` | `{}`               | Explicit environment variables passed to all scripts         |
| `envMode` | `'isolate' \| 'inherit'` | `'isolate'`        | Controls base environment: minimal isolation or full inherit |

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

### `envFile`

Path or array of paths to `.env` files, resolved relative to the config file directory. Missing files are silently skipped. When multiple files are provided, later files override earlier ones.

```ts
export default defineConfig({
  envFile: '.env',
  // or multiple files:
  envFile: ['.env', '.env.local'],
});
```

### `env`

Explicit environment variables passed to all scripts. These override variables from `envFile` but are overridden by script-level `env` and CLI `--env` flags.

```ts
export default defineConfig({
  env: {
    NODE_ENV: 'development',
    LOG_LEVEL: 'debug',
  },
});
```

### `envMode`

Controls the base environment for child processes. Defaults to `'isolate'`.

- **`'isolate'`** (default): Scripts start with a minimal environment containing only `PATH`, `HOME`, `TERM`, `SHELL`, `USER`, `LANG`, and `TMPDIR`. This prevents secrets and ambient variables from leaking into scripts.
- **`'inherit'`**: Scripts inherit the full parent `process.env`. Use this if your scripts depend on ambient environment variables.

```ts
export default defineConfig({
  envMode: 'inherit', // opt into full environment inheritance
});
```

**Merge priority** (right wins): base env < envFile < config `env` < script `env` < CLI `--env`

## Config Loading Behavior

Lauf searches upward from the current directory for the nearest config file. Your settings are merged with the built-in defaults and validated at load time.

If no config file is found, Lauf falls back to the default values. If validation fails, a warning is printed and defaults are used.

## `defineConfig`

```ts
import { defineConfig } from 'laufen';
```

An identity function that provides TypeScript type inference for your config. It accepts a config object and returns it unchanged.
