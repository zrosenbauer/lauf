# CLI Reference

Lauf provides a small set of commands for managing and running TypeScript scripts across your monorepo.

## Usage

```bash
lauf <command> [options]
```

## Commands

| Command                        | Description                            |
| ------------------------------ | -------------------------------------- |
| [`init`](/cli/init)            | Initialize lauf in the current package |
| [`list`](/cli/list)            | List all available scripts             |
| [`run [script]`](/cli/run)     | Run a script                           |
| [`info [script]`](/cli/info)   | Show info for a script                 |
| [`create [name]`](/cli/create) | Create a new script                    |

## Global Flags

| Flag              | Description         |
| ----------------- | ------------------- |
| `--help`, `-h`    | Show help           |
| `--version`, `-v` | Show version number |

## How Arguments Work

When running scripts, arguments are passed as CLI flags after the script name:

```bash
lauf run @my-org/api/generate-types --outDir=./src --verbose=true
```

Values are automatically coerced:

- `"true"` / `"false"` become booleans
- Numeric strings (e.g., `"42"`, `"3.14"`) become numbers
- Everything else stays a string

Arguments are validated against the script's Zod schema at runtime. If validation fails, you get a clear error message describing what went wrong.

### Flag Formats

```bash
--key=value       # explicit assignment
--key value       # space-separated
--flag            # boolean true (no value)
```

Positional arguments (values without `--`) are not supported and will trigger a warning.
