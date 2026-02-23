<img src="assets/banner.svg" alt="lauf" width="100%" />

<p align="center">
  <b>Typed script runner for monorepos</b><br/>
  Discover, validate, and execute TypeScript scripts with Zod-powered arguments.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/laufen"><img src="https://img.shields.io/npm/v/laufen.svg" alt="npm version" /></a>
  <a href="https://github.com/zrosenbauer/lauf/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/laufen.svg" alt="license" /></a>
  <a href="https://www.npmjs.com/package/laufen"><img src="https://img.shields.io/npm/dm/laufen.svg" alt="downloads" /></a>
</p>

---

## Name

**laufen** is German for _to run_. The npm package is `laufen`, the CLI command is `lauf`.

---

## Features

- **Config-driven** — A `lauf.config.ts` at your workspace root defines script glob patterns and optional logger overrides. Run `lauf init` to scaffold one.

- **Workspace-agnostic** — Auto-detects pnpm, npm, yarn, bun, lerna, and single-package projects. No lock-in to a specific package manager.

- **Automatic script discovery** — Scans every workspace package for scripts matching your configured patterns. No registration or manifest files needed.

- **Zod-powered validation** — Define arguments with Zod schemas and get runtime validation + full TypeScript inference for free. CLI flags are automatically coerced to the correct types.

- **Isolated execution** — Each script runs in its own child process via `tsx`, so a crash never takes down your CLI.

- **Rich script context** — Every script receives a structured context with a logger, spinner, and interactive prompts (text, confirm, select, multiselect, password, path) powered by `@clack/prompts`.

- **Auto-prompting** — When a script defines required args via a Zod schema and they are not provided as CLI flags, lauf interactively prompts the user for each missing value. This makes scripts work both interactively (no flags) and in automation (all flags provided).

- **Built-in scaffolding** — `lauf create` generates a ready-to-run script with typed args and a run function from a starter template.

- **Script help** — `lauf info` displays a script's typed arguments, descriptions, and defaults without executing it.

- **Tiny API surface** — One function (`lauf()`), one schema library (`z`), one convention (`scripts/` directory). That's it.

---

## Installation

```bash
pnpm add -D laufen
```

> **Requires Node.js >= 22.0.0**

## Quick Start

### 1. Initialize

```bash
lauf init
```

This creates a `lauf.config.ts` at the workspace root:

```ts
import { defineConfig } from 'laufen';

export default defineConfig({
  scripts: ['scripts/*.ts'],
});
```

### 2. Define a script

Create a file at `<package>/scripts/hello.ts`:

```ts
import { lauf, z } from 'laufen';

export default lauf({
  description: 'Say hello',
  args: {
    name: z.string().default('world'),
    loud: z.boolean().default(false),
  },
  async run(ctx) {
    const greeting = `Hello, ${ctx.args.name}!`;
    ctx.logger.info(ctx.args.loud ? greeting.toUpperCase() : greeting);
  },
});
```

### 3. Run it

```bash
lauf run @my-org/my-package/hello --name=Zac --loud=true
```

Arguments are parsed, validated against your Zod schema, and passed to `run()` with full type safety.

## CLI Commands

### `lauf init`

Create a `lauf.config.ts` in the current workspace root.

```bash
lauf init
```

### `lauf list`

Discover and list all available scripts across the workspace.

```bash
lauf list
```

### `lauf run [script]`

Execute a script by its qualified name (`<package-name>/<script-name>`). If omitted, an interactive prompt lets you pick one.

```bash
lauf run @my-org/api/generate-types --outDir=./src --verbose=true
```

Arguments are passed as CLI flags and automatically coerced to the correct types (strings, numbers, booleans). Pass `--help` or `-h` to see a script's arguments without running it.

**Auto-prompting:** If a script defines required args (no `.default()`) and you omit them from the CLI, lauf will interactively prompt you for each missing value. Boolean args show a confirm prompt, enum args show a select list, and everything else shows a text input. This means scripts work seamlessly both interactively (run with no flags) and in CI/automation (provide all flags).

### `lauf info [script]`

Display help for a script — its description, typed arguments, and defaults. If omitted, an interactive prompt lets you pick one.

```bash
lauf info @my-org/api/generate-types
```

### `lauf create [name]`

Scaffold a new script with a starter template. If omitted, an interactive prompt asks for the name.

```bash
lauf create my-script
lauf create my-script --dir=packages/api/scripts
```

## Configuration

Lauf requires a `lauf.config.ts` at the workspace root. Use `defineConfig()` for type inference:

```ts
import { defineConfig } from 'laufen';

export default defineConfig({
  scripts: ['scripts/*.ts'], // glob patterns relative to each package
  logger: customLogger, // optional logger override
});
```

| Property  | Type            | Default            | Description                                   |
| --------- | --------------- | ------------------ | --------------------------------------------- |
| `scripts` | `string[]`      | `['scripts/*.ts']` | Glob patterns to discover scripts per package |
| `logger`  | `DefaultLogger` | built-in           | Optional custom logger implementation         |
| `spinner` | `boolean`       | `true`             | Whether the script context includes a spinner |

## Script API

### `lauf(config)`

The only function you need. Define your script's description, arguments, and run function:

```ts
import { lauf, z } from 'laufen';

export default lauf({
  description: 'Generate TypeScript types from templates',
  args: {
    outDir: z.string().default('./src/generated'),
    verbose: z.boolean().default(false),
  },
  async run(ctx) {
    ctx.spinner.start('Generating types...');
    // ... your logic here
    ctx.spinner.stop('Done');
    ctx.logger.success(`Output written to ${ctx.args.outDir}`);
  },
});
```

### Script Context

Every script's `run` function receives a context object:

| Property     | Type            | Description                                                                                        |
| ------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| `args`       | `InferArgs<T>`  | Parsed and validated arguments                                                                     |
| `root`       | `string`        | Absolute path to the workspace root                                                                |
| `packageDir` | `string`        | Absolute path to the containing package                                                            |
| `name`       | `string`        | Qualified script name (e.g. `@org/pkg/foo`)                                                        |
| `logger`     | `DefaultLogger` | Structured terminal output — `info()`, `warn()`, `error()`, `success()`, `message()`, `newlines()` |
| `spinner`    | `Spinner`       | Progress indicator — `start()`, `stop()`, `message()`                                              |
| `prompts`    | `Prompts`       | Interactive prompts — `text()`, `confirm()`, `select()`, `multiselect()`, `password()`, `path()`   |

## How It Works

1. **Configuration** — Lauf loads `lauf.config.ts` from the workspace root, merging your settings with defaults.

2. **Workspace detection** — Lauf walks up the directory tree looking for workspace markers (`pnpm-workspace.yaml`, `package.json` workspaces, `lerna.json`) and resolves all workspace packages. Falls back to single-package mode if none are found.

3. **Discovery** — Each workspace package is scanned for scripts matching the configured glob patterns (default: `scripts/*.ts`).

4. **Execution** — When you run a script, Lauf spawns an isolated child process using `tsx`, passes context via environment variables, validates arguments against the Zod schema, and calls `run()` with the fully typed context.

5. **Validation** — Arguments are coerced from CLI strings into the correct types and validated against your Zod schema at runtime. If validation fails, you get a clear error message.

## Convention

Scripts live in a `scripts/` directory (or whatever your config specifies) inside any workspace package:

```
my-monorepo/
├── lauf.config.ts              # required
├── pnpm-workspace.yaml         # or package.json workspaces, lerna.json, etc.
├── packages/
│   ├── api/
│   │   ├── package.json        # name: "@my-org/api"
│   │   └── scripts/
│   │       └── generate-types.ts
│   └── web/
│       ├── package.json        # name: "@my-org/web"
│       └── scripts/
│           ├── build-icons.ts
│           └── seed-db.ts
```

Scripts are referenced by their qualified name: `@my-org/api/generate-types`, `@my-org/web/seed-db`, etc.

## Security

`lauf.config.ts` is executable TypeScript — it runs code when lauf loads the config. Config discovery walks up parent directories from the current working directory to find the nearest config file, stopping at the git root. In shared repositories or monorepos with multiple contributors, always audit config files before running `lauf`. Treat `lauf.config.ts` with the same caution as any other executable configuration (e.g., `.eslintrc.js`, `commitlint.config.ts`).

## License

[MIT](LICENSE)
