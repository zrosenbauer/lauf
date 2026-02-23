# examples

## Setup

From the monorepo root:

```bash
pnpm install
pnpm --filter lauf build
```

## Usage

All commands are run from the `examples/` directory.

### List available scripts

```bash
pnpm lauf list
```

### Run a script

```bash
# Generate API docs from a source file using AI
pnpm lauf run @examples/lauf/docs -- --src src/index.ts

# Clean build artifacts (with confirmation prompt)
pnpm lauf run @examples/lauf/clean

# Clean build artifacts (skip confirmation)
pnpm lauf run @examples/lauf/clean -- --force

# Fetch GitHub releases and save locally
pnpm lauf run @examples/lauf/fetch-releases -- --repo "vercel/next.js"
```

## Scripts

| Script            | Description                                         |
| ----------------- | --------------------------------------------------- |
| `docs`            | Generate API docs from a source file using AI       |
| `clean`           | Clean build artifacts with confirmation for safety   |
| `fetch-releases`  | Fetch GitHub releases for a repo and save to JSON   |

## Writing your own

Create a new file in `scripts/` with the `.ts` extension:

```ts
import { lauf, z } from 'laufen';

export default lauf({
  description: 'My custom script',
  args: {
    name: z.string().describe('Your name'),
    verbose: z.boolean().default(false).describe('Enable verbose output'),
  },
  async run(ctx) {
    ctx.logger.info(`Hello, ${ctx.args.name}!`);

    if (ctx.args.verbose) {
      ctx.logger.info(`Running from ${ctx.packageDir}`);
    }

    ctx.logger.success('Done!');
  },
});
```

Then run it:

```bash
pnpm lauf run @examples/lauf/my-custom-script -- --name "Zac"
```
