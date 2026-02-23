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

| Property  | Type       | Default            | Description                                     |
| --------- | ---------- | ------------------ | ----------------------------------------------- |
| `scripts` | `string[]` | `['scripts/*.ts']` | Glob patterns to discover scripts per package   |
| `logger`  | `Logger`   | built-in           | Custom logger implementation                    |
| `spinner` | `boolean`  | `true`             | Enable or disable the progress spinner globally |

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

## Config Loading Behavior

Lauf searches upward from the current directory for the nearest config file. Your settings are merged with the built-in defaults and validated at load time.

If no config file is found, Lauf falls back to the default values. If validation fails, a warning is printed and defaults are used.

## `defineConfig`

```ts
import { defineConfig } from 'laufen';
```

An identity function that provides TypeScript type inference for your config. It accepts a config object and returns it unchanged.
