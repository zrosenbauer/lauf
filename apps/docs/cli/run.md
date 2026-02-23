# `lauf run`

Execute a script by its qualified name.

## Usage

```bash
lauf run [script] [--arg=value ...]
```

## Parameters

| Parameter | Required | Description                                                |
| --------- | -------- | ---------------------------------------------------------- |
| `script`  | No       | Qualified script name (e.g., `@my-org/api/generate-types`) |

If the script name is omitted, an interactive prompt lets you select from all discovered scripts.

## Arguments

Arguments are passed as CLI flags after the script name:

```bash
lauf run @my-org/api/generate-types --outDir=./src --verbose=true
```

### Supported Formats

```bash
--key=value       # explicit assignment
--key value       # space-separated
--flag            # boolean true (no value)
```

### Type Coercion

Values are automatically coerced before validation:

| Input            | Result         |
| ---------------- | -------------- |
| `"true"`         | `true`         |
| `"false"`        | `false`        |
| `"42"`, `"3.14"` | `42`, `3.14`   |
| everything else  | stays a string |

Hex strings (`0x...`) and scientific notation (`1e10`) are not coerced -- they remain strings.

## Inline Help

Pass `--help` or `-h` after the script name to see its arguments without running it:

```bash
lauf run @my-org/api/generate-types --help
```

This is equivalent to running `lauf info @my-org/api/generate-types`.

## Behavior

1. Loads the nearest `lauf.config.ts`
2. Resolves the script by qualified name (or prompts for selection)
3. Parses trailing CLI flags into arguments
4. Validates arguments against the script's Zod schema
5. Executes the script in an isolated process
6. Reports the exit code

## Error Cases

| Scenario             | Message                                         |
| -------------------- | ----------------------------------------------- |
| Config load failure  | `Failed to load lauf config: <error>`           |
| Script not found     | `Script not found: <name>`                      |
| Non-zero exit        | `<script> exited with code <n>`                 |
| Positional arguments | Warning: `Positional arguments were ignored...` |

## Notes

- Each script runs in its own process, so it cannot crash the CLI
- Scripts have full access to Node.js APIs
- Scripts control their own spinner via `ctx.spinner`
