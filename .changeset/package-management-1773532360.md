---
'@laufen/engine': minor
'laufen': minor
---

Add package management for script dependencies

Scripts can now declare npm packages that are automatically installed to a cache directory (`~/.lauf/packages/<hash>/`) without polluting project dependencies. Packages are available via type-safe `ctx.import()` method.

**Key features:**

- Workspace-level packages in `lauf.config.ts` available to all scripts
- Script-level packages in script config (overrides workspace packages)
- Auto-detection of package manager (pnpm, npm, yarn, bun)
- Cache reuse based on package set hash
- Type-safe imports with automatic `.lauf/packages.d.ts` generation
- Cross-process locking to prevent concurrent installations
- Externals integration with esbuild
- Runtime validation of packages field

**Usage:**

```typescript
// lauf.config.ts
export default defineConfig({
  packages: {
    rimraf: '^6.0.0',
    execa: '^9.0.0',
  },
});

// script.ts
export default lauf({
  description: 'Example package-managed script',
  packages: {
    chalk: '^5.0.0',
  },
  async run(ctx) {
    const { default: chalk } = await ctx.import('chalk');
    const { rimraf } = await ctx.import('rimraf');
    ctx.logger.info(chalk.blue('Styled text!'));
  },
});
```
