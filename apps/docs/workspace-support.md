# Workspace Support

Lauf auto-detects your workspace manager and resolves all packages without any extra configuration.

## Supported Managers

| Manager | How it's detected                                           |
| ------- | ----------------------------------------------------------- |
| pnpm    | `pnpm-workspace.yaml`                                       |
| npm     | `package.json` with `workspaces`                            |
| yarn    | `package.json` with `workspaces` + `yarn.lock`              |
| bun     | `package.json` with `workspaces` + `bun.lockb` / `bun.lock` |
| lerna   | `lerna.json`                                                |
| single  | Fallback when no workspace is found                         |

## Detection Order

Lauf checks for workspace markers in this order:

1. **pnpm** -- looks for `pnpm-workspace.yaml`
2. **npm/yarn/bun** -- looks for a `workspaces` field in `package.json`, then checks lockfiles to distinguish between managers
3. **lerna** -- looks for `lerna.json`
4. **single** -- if no workspace marker is found, Lauf falls back to single-package mode

The search walks upward from the current directory until it finds a match or reaches the filesystem root.

## How Discovery Works

Once the workspace root and package locations are resolved:

1. Lauf finds all package directories from your workspace config
2. Each package is scanned for script files matching the configured `scripts` patterns (default: `scripts/*.ts`)
3. Each matched file is assigned a qualified name: `<package-name>/<script-stem>`
4. The package name comes from the `name` field in that package's `package.json`

### Single-Package Mode

When no workspace markers are found, Lauf treats the current directory as both the root and the sole package. Scripts are discovered directly from the configured glob patterns relative to that directory.

## Example Structure

```
my-monorepo/
  lauf.config.ts
  pnpm-workspace.yaml
  packages/
    api/
      package.json            # name: "@my-org/api"
      scripts/
        generate-types.ts     # -> @my-org/api/generate-types
        seed-db.ts            # -> @my-org/api/seed-db
    web/
      package.json            # name: "@my-org/web"
      scripts/
        build-icons.ts        # -> @my-org/web/build-icons
```
