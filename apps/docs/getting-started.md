# Getting Started

## Prerequisites

- **Node.js >= 22.0.0**
- A package manager (pnpm, npm, yarn, or bun)

## Installation

::: code-group

```bash [pnpm]
pnpm add -D laufen
```

```bash [npm]
npm install -D laufen
```

```bash [yarn]
yarn add -D laufen
```

```bash [bun]
bun add -D laufen
```

:::

The npm package is called `laufen`. The CLI binary is `lauf`.

## Initialize

Run `lauf init` in your workspace root to scaffold a config file:

```bash
lauf init
```

This creates a `lauf.config.ts`:

```ts
import { defineConfig } from 'laufen';

export default defineConfig({
  scripts: ['scripts/*.ts'],
});
```

## Write Your First Script

Create a file at `scripts/hello.ts` (or inside any workspace package at `<package>/scripts/hello.ts`):

```ts
import { lauf, z } from 'laufen';

export default lauf({
  description: 'Say hello',
  args: {
    name: z.string().default('world'),
    loud: z.boolean().default(false),
  },
  async run(ctx) {
    const greeting = `Hello, ${ctx.args.name}!`;
    if (ctx.args.loud) {
      ctx.logger.success(greeting.toUpperCase());
    } else {
      ctx.logger.success(greeting);
    }
  },
});
```

## Run It

```bash
lauf run hello --name=Zac --loud=true
```

Arguments are parsed, validated against your Zod schema, and passed to `run()` with full type safety.

If you omit the script name, Lauf presents an interactive picker:

```bash
lauf run
```

## What's Next?

- [Configuration](/configuration) -- customize script patterns and logger
- [Writing Scripts](/scripts) -- the full `lauf()` API and script context
- [CLI Reference](/cli/) -- all available commands
- [Examples](/examples) -- walkthrough of real scripts
