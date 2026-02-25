# Add a CLI Command

Add a new command to the lauf CLI end-to-end: handler, registration, and verification.

## Prerequisites

- Familiarity with the [CLI concepts](../concepts/cli.md) and [architecture](../concepts/architecture.md)
- The project builds successfully (`pnpm build`)

## Steps

### 1. Create the handler file

Create `src/handlers/<name>.ts`. Import `defineHandler`, define a Zod schema for the Clerc context if the command accepts parameters or flags, and implement the handler returning `HandlerResult`.

```ts
import { z } from 'zod';

import { defineHandler } from '../lib/handler.ts';
import { fail, ok } from '../lib/result.ts';

const checkParams = z.object({
  flags: z.object({ fix: z.boolean().optional() }),
});

export default defineHandler({
  parameters: checkParams,
  handler: async (ctx) => {
    const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
    if (configError) {
      return fail({ message: `Failed to load config: ${configError.message}` });
    }

    const scripts = discoverScripts(loaded.config.scripts);

    // ... validate scripts ...

    return ok();
  },
});
```

For commands without parameters or flags, use the plain function form:

```ts
export default defineHandler(() => {
  // ... implementation ...
  return ok();
});
```

### 2. Register the command

In `src/index.ts`, import the handler and chain `.command()` and `.on()` on the Clerc builder:

```ts
import handleCheck from './handlers/check.ts';

// Inside the Clerc.create() chain:
  .command('check', 'Validate all scripts can be imported', {
    flags: {
      fix: {
        type: Boolean,
        description: 'Auto-fix issues where possible',
        alias: 'f',
      },
    },
  })
  .on('check', handleCheck)
```

The `.command()` call accepts:

| Field                 | Purpose                                  |
| --------------------- | ---------------------------------------- |
| Name (1st arg)        | Command name used on the CLI             |
| Description (2nd arg) | Shown in `--help` output                 |
| Options (3rd arg)     | `parameters` array and/or `flags` object |

### 3. Add lib functions if needed

If the command needs new shared logic (config loading, discovery, path resolution), add it to `src/lib/`. Follow the existing patterns:

- Return `Result` tuples instead of throwing
- Use Zod for runtime validation
- Keep functions pure where possible

### 4. Write tests

Create `src/handlers/<name>.test.ts` following existing test patterns. Test the handler function directly by calling it with mock Clerc contexts:

- Test the success path returns `ok()`
- Test each failure path returns `fail()` with the expected message
- Test Zod validation rejects invalid contexts

### 5. Verify

Run the full CI check suite:

```bash
pnpm lint && pnpm fmt:check && pnpm typecheck && pnpm build
```

## Verification

After completing all steps:

1. Run `pnpm build` and confirm no errors
2. Run `pnpm lauf <name> --help` and confirm the command appears
3. Run the command and verify the expected behavior

## Troubleshooting

### Command not appearing in help

**Issue:** The new command does not show up in `lauf --help`.

**Fix:** Ensure `.command()` is chained before `.parse()` in `src/index.ts` and the command name matches the `.on()` event name exactly.

### Zod validation fails at runtime

**Issue:** The handler receives a validation error for a valid-looking context.

**Fix:** Verify the Zod schema matches the exact shape Clerc produces. Clerc wraps parameters in `{ parameters: { ... } }` and flags in `{ flags: { ... } }`. Use `z.object({ parameters: z.object({ ... }), flags: z.object({ ... }) })` to match.

## References

- [CLI](../concepts/cli.md)
- [Architecture](../concepts/architecture.md)
- [Coding Style](../standards/typescript/coding-style.md)
- [Errors](../standards/typescript/errors.md)
