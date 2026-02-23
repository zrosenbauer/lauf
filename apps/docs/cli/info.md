# `lauf info`

Display help for a script -- its description, typed arguments, and defaults -- without executing it.

## Usage

```bash
lauf info [script]
```

## Parameters

| Parameter | Required | Description                                                |
| --------- | -------- | ---------------------------------------------------------- |
| `script`  | No       | Qualified script name (e.g., `@my-org/api/generate-types`) |

If the script name is omitted, an interactive prompt lets you select from all discovered scripts.

## Behavior

1. Loads the nearest `lauf.config.ts`
2. Resolves the script by qualified name (or prompts for selection)
3. Reads the script's metadata and prints:
   - The script description
   - Each argument with its type, default value, and description

## Example Output

```
┌ @my-org/api/generate-types
│
│ Generate TypeScript types from templates
│
│ Arguments:
│   outDir    string   (default: "./src/generated")   Output directory for generated files
│   verbose   boolean  (default: false)               Enable verbose logging
│
└
```

## Error Cases

| Scenario                | Message                               |
| ----------------------- | ------------------------------------- |
| Config load failure     | `Failed to load lauf config: <error>` |
| Script not found        | `Script not found: <name>`            |
| Help extraction failure | `Help failed for <name>`              |

## Notes

- This command does **not** execute the script's `run()` function
- You can also use `lauf run <script> --help` as a shortcut for `lauf info <script>`
