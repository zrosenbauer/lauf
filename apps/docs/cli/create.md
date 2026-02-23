# `lauf create`

Scaffold a new script with a starter template.

## Usage

```bash
lauf create [name]
lauf create [name] --dir=<path>
```

## Parameters

| Parameter | Required | Description             |
| --------- | -------- | ----------------------- |
| `name`    | No       | Name for the new script |

If the name is omitted, an interactive prompt asks for it.

## Flags

| Flag    | Description                                             |
| ------- | ------------------------------------------------------- |
| `--dir` | Target directory (absolute, or relative to config root) |

## Behavior

1. Resolves the script name (from the parameter or via prompt)
2. Loads the nearest `lauf.config.ts`
3. Determines the target directory:
   - If `--dir` is provided with an absolute path, uses it directly
   - If `--dir` is provided with a relative path, resolves it from the config directory
   - If `--dir` is omitted, uses the first configured script pattern's directory (default: `scripts/`)
4. Creates the target directory if it doesn't exist
5. Writes a `<name>.ts` file with the starter template

The generated script looks like:

```ts
import { lauf, z } from 'laufen';

export default lauf({
  description: 'TODO: describe what my-script does',
  args: {
    name: z.string().describe('TODO: describe this argument'),
  },
  async run(ctx) {
    ctx.logger.info('Hello from my-script');
  },
});
```

## Error Cases

| Scenario                   | Message                                        |
| -------------------------- | ---------------------------------------------- |
| Config load failure        | `Failed to load lauf config: <error>`          |
| File already exists        | `File already exists: <path>`                  |
| Directory creation failure | `Failed to create directory <path>: <error>`   |
| Path escapes config root   | `Target directory escapes config root: <path>` |

## Notes

- Existing scripts will not be overwritten
- The target directory must be within the config root
