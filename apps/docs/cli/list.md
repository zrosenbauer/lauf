# `lauf list`

Discover and list available scripts in the workspace.

## Usage

```bash
lauf list                     # scripts from the current package only
lauf list --all               # scripts from all packages and configs
lauf list --filter "@apps/*"  # scripts from packages matching the glob
```

## Flags

| Flag       | Alias | Description                                     |
| ---------- | ----- | ----------------------------------------------- |
| `--all`    | `-a`  | Discover scripts from all nested configs        |
| `--filter` | `-f`  | Filter packages by name glob (e.g. `"@apps/*"`) |

When both flags are provided, `--filter` takes priority over `--all`.

## Behavior

1. Determines which packages to scan (current package by default, all with `--all`, or matching with `--filter`)
2. Loads the nearest `lauf.config.ts` (or all configs if `--all` is passed)
3. Scans matching workspace packages for scripts matching the configured glob patterns
4. Prints a hierarchical tree grouped by package name, with descriptions

## Output

Scripts are displayed grouped by their containing package:

```
┌ Found 3 script(s)
│
│ @my-org/api
│   generate-types   Generate TypeScript types from templates
│   seed-db          Seed the database with test data
│
│ @my-org/web
│   build-icons      Build icon sprites from SVGs
│
└
```

If no scripts are found, a hint is shown:

```
◇ No scripts found.
│ Create one with: lauf create <name>
```

## Default: Current Package

By default, `lauf list` shows only scripts from the package you are currently inside. This is determined by comparing `process.cwd()` against the workspace package directories. If you are at the workspace root, only root-level scripts are shown.

If the current directory is not inside any known workspace package, an error is shown with a hint to use `--all`.

## The `--all` Flag

With `--all`, lauf discovers all config files within the search boundary and aggregates scripts from every package. When multiple configs match the same script, the shallowest config wins.

## The `--filter` Flag

With `--filter`, only packages whose names match the given glob pattern are included. This uses [picomatch](https://github.com/micromatch/picomatch) syntax:

```bash
lauf list --filter "@apps/*"     # all packages under the @apps scope
lauf list --filter "my-pkg"      # exact package name
lauf list --filter "*-utils"     # packages ending in -utils
```

## Notes

- If description extraction fails, scripts are still listed -- just without descriptions
- The list command reads scripts but does not execute them
