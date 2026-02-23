# `lauf init`

Initialize lauf in the current directory by creating a `lauf.config.ts` file.

## Usage

```bash
lauf init
```

## Behavior

1. Checks if a config already exists by searching upward from the current directory
2. If a config is found, exits with an error ("Already initialized")
3. If no config exists, writes a new `lauf.config.ts` in the current directory

The generated config file contains:

```ts
import { defineConfig } from 'laufen';

export default defineConfig({
  scripts: ['scripts/*.ts'],
});
```

## Error Cases

| Scenario                           | Message                                              |
| ---------------------------------- | ---------------------------------------------------- |
| Config found in a parent directory | `Already initialized: config found at <path>`        |
| `lauf.config.ts` already exists    | `Already initialized: lauf.config.ts already exists` |
| Write failure                      | `Failed to write lauf.config.ts: <error>`            |

## Notes

- Existing config files will not be overwritten
- The upward search finds both `lauf.config.ts` and `laufen.config.ts` in any ancestor directory
