# Overview

Lauf is a typed script runner for monorepos. It discovers, validates, and executes TypeScript scripts with Zod-powered arguments across your entire workspace.

## Why Lauf?

Monorepos accumulate ad-hoc scripts -- data migrations, code generators, health checks, seed scripts. These scripts live in random places, take undocumented arguments, and break silently. Lauf gives them structure:

- **One convention** -- scripts live in a `scripts/` directory (or whatever glob you configure) inside any workspace package.
- **One function** -- `lauf()` defines your script's description, typed arguments, and run function.
- **One command** -- `lauf run` discovers, validates, and executes any script by its qualified name.

## How It Works

1. **Configuration** -- Lauf loads `lauf.config.ts` from the workspace root, merging your settings with sensible defaults.

2. **Workspace detection** -- Lauf detects your workspace layout (`pnpm-workspace.yaml`, `package.json` workspaces, `lerna.json`) and resolves all packages. Falls back to single-package mode if none are found.

3. **Discovery** -- Each workspace package is scanned for scripts matching the configured glob patterns (default: `scripts/*.ts`).

4. **Execution** -- When you run a script, Lauf spawns it in an isolated process, validates arguments against the Zod schema, and calls `run()` with a fully typed context.

5. **Validation** -- Arguments are coerced from CLI strings into the correct types and validated at runtime. If validation fails, you get a clear error message.

## Name

**laufen** is German for _to run_. The npm package is `laufen`, the CLI command is `lauf`.
