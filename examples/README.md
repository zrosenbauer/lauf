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

# Watch TypeScript source files and report changes on save
pnpm lauf run @examples/lauf/dev --watch
```

## Scripts

| Script           | Description                                              | Packages Used |
| ---------------- | -------------------------------------------------------- | ------------- |
| `docs`           | Generate API docs from a source file using AI            | -             |
| `clean`          | Clean build artifacts with confirmation for safety       | rimraf, chalk |
| `fetch-releases` | Fetch GitHub releases for a repo and save to JSON        | -             |
| `format-json`    | Format JSON files with prettier                          | prettier      |
| `with-utils`     | Example using ctx.dir and ctx.fs helpers                 | -             |
| `using-lib`      | Example using shared utility libraries                   | -             |
| `dev`            | Watch TypeScript source files and report changes on save | -             |

## Package Management

Lauf automatically manages package dependencies for your scripts without polluting your project's `node_modules`. Packages are installed to a cache directory (`~/.lauf/packages/<hash>/`) and made available via dynamic imports.

### Workspace-level Packages

Define packages in `lauf.config.ts` to make them available to all scripts:

```typescript
// lauf.config.ts
import { defineConfig } from 'laufen';

export default defineConfig({
  scripts: ['scripts/*.ts'],
  packages: {
    rimraf: '^6.0.0',
    execa: '^9.0.0',
  },
});
```

### Script-level Packages

Define packages in individual scripts for script-specific dependencies:

```typescript
// scripts/format-json.ts
import { lauf } from 'laufen';

export default lauf({
  description: 'Format JSON files',
  packages: {
    prettier: '^3.0.0',
  },
  async run(ctx) {
    const prettier = await import('prettier');
    // Use prettier...
  },
});
```

### Combining Both

Scripts can use both workspace and script-level packages. Script packages take precedence for version conflicts:

```typescript
// scripts/clean.ts
export default lauf({
  description: 'Clean build artifacts',
  packages: {
    chalk: '^5.0.0', // Script-specific
  },
  async run(ctx) {
    const { rimraf } = await import('rimraf'); // From workspace
    const chalk = (await import('chalk')).default; // From script

    await rimraf(['dist', 'node_modules']);
    ctx.logger.success(chalk.green('✓ Cleanup complete'));
  },
});
```

**Key benefits:**

- No need to install script dependencies in your project
- Packages are cached and reused across scripts with identical dependencies
- Each script can use different versions of the same package
- Zero impact on project `package.json`

### TypeScript Configuration for Package Types

To get full IntelliSense and type checking for packages used via `ctx.import()`, add `.lauf` to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["scripts", ".lauf/**/*.d.ts"]
}
```

When you run a script with packages, lauf auto-generates `.lauf/packages.d.ts` with type mappings. Adding it to your `include` gives you full autocomplete:

```typescript
const chalk = await ctx.import('chalk'); // ← Full type inference!
```

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

### Watch

Available when running with `--watch`:

- `ctx.watch.enabled` - `true` when running under `--watch`, `false` otherwise
- `ctx.watch.changedFiles` - paths that triggered this rerun (empty on initial run)
- `ctx.watch.patterns` - glob patterns currently being watched

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
