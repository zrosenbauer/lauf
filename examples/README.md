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

| Script           | Description                                        |
| ---------------- | -------------------------------------------------- |
| `docs`           | Generate API docs from a source file using AI      |
| `clean`          | Clean build artifacts with confirmation for safety |
| `fetch-releases` | Fetch GitHub releases for a repo and save to JSON  |
| `with-utils`     | Example using ctx.dir and ctx.fs helpers           |
| `using-lib`      | Example using shared utility libraries             |

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
      ctx.logger.info(`Running from ${ctx.dir.package}`);
    }

    ctx.logger.success('Done!');
  },
});
```

Then run it:

```bash
pnpm lauf run @examples/lauf/my-custom-script -- --name "Zac"
```

## Creating Reusable Utilities

You can create shared utility libraries for your scripts:

### 1. Create a lib directory

```
examples/
├── lib/
│   └── utils.ts
└── scripts/
    └── my-script.ts
```

### 2. Export utilities

```typescript
// lib/utils.ts
export const formatDate = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0];
};

export const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
};
```

### 3. Import in scripts

```typescript
// scripts/my-script.ts
import { lauf } from 'laufen';
import { formatDate, readJsonFile } from '../lib/utils.js';

export default lauf({
  description: 'Script using shared utilities',
  async run(ctx) {
    const data = await readJsonFile('data.json');
    ctx.logger.info(`Date: ${formatDate()}`);
  },
});
```

**Note:** Use `.js` extension in imports even for `.ts` files (Node ESM convention).

## Context API

The script context (`ctx`) provides:

### Paths

- `ctx.dir.root` - Workspace root (git repository root)
- `ctx.dir.package` - Package directory where the script lives
- `ctx.dir.workspace` - Alias for `ctx.dir.package`

### Filesystem Helpers

All paths are resolved relative to the package directory:

- `ctx.fs.readFile(path, encoding?)` - Read file contents
- `ctx.fs.writeFile(path, data)` - Write file (creates parent dirs)
- `ctx.fs.copyFile(src, dest)` - Copy file
- `ctx.fs.mkdir(path)` - Create directory recursively
- `ctx.fs.rm(path)` - Remove file or directory recursively
- `ctx.fs.exists(path)` - Check if path exists
- `ctx.fs.stat(path)` - Get file stats

Example:

```typescript
export default lauf({
  async run(ctx) {
    // Read package.json from package directory
    const pkg = await ctx.fs.readFile('package.json', 'utf-8');

    // Write to dist/output.json (creates dist/ if needed)
    await ctx.fs.writeFile('dist/output.json', pkg);

    // Check if file exists
    const exists = await ctx.fs.exists('tsconfig.json');
  },
});
```
