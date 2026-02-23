# `lauf list`

Discover and list all available scripts across the workspace.

## Usage

```bash
lauf list
lauf list --all
```

## Flags

| Flag    | Alias | Description                              |
| ------- | ----- | ---------------------------------------- |
| `--all` | `-a`  | Discover scripts from all nested configs |

## Behavior

1. Loads the nearest `lauf.config.ts` (or all configs if `--all` is passed)
2. Scans every workspace package for scripts matching the configured glob patterns
3. Prints a hierarchical tree grouped by package name, with descriptions

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

## The `--all` Flag

By default, `lauf list` uses the nearest config file. With `--all`, it discovers all config files within the search boundary and aggregates scripts from each. When multiple configs match the same script, the shallowest config wins.

## Notes

- If description extraction fails, scripts are still listed -- just without descriptions
- The list command reads scripts but does not execute them
