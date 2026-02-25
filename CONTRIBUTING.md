# Contributing to lauf

Thanks for your interest in contributing to lauf! This document covers the basics you need to get started.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22.0.0
- [pnpm](https://pnpm.io/) 10.x (`corepack enable` to activate)

## Getting Started

1. Fork and clone the repo
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Make sure everything builds and passes checks:

   ```bash
   pnpm lint && pnpm fmt:check && pnpm typecheck && pnpm build
   ```

## Development Workflow

### Available Commands

| Command          | Description                        |
| ---------------- | ---------------------------------- |
| `pnpm build`     | Build all packages (via Turborepo) |
| `pnpm lint`      | Lint with OXLint                   |
| `pnpm lint:fix`  | Auto-fix lint issues               |
| `pnpm fmt`       | Format with OXFmt                  |
| `pnpm fmt:check` | Check formatting                   |
| `pnpm typecheck` | Type check all packages            |

### Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b my-change
   ```
2. Make your changes
3. Run the full check suite before committing:
   ```bash
   pnpm lint && pnpm fmt:check && pnpm typecheck && pnpm build
   ```
4. Commit your changes (see [Commit Messages](#commit-messages))

## Pull Requests

- Open PRs against the `main` branch
- Keep PRs focused — one logical change per PR
- Include a clear description of **what** changed and **why**
- Make sure CI passes (lint, format, typecheck, build)

## Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and changelogs. If your change affects the published package, add a changeset:

```bash
pnpm changeset
```

Follow the prompts to select the package and semver bump type. The generated changeset file should be committed with your PR.

Not every PR needs a changeset — skip it for docs-only changes, CI tweaks, or other non-published updates.

## Commit Messages

All commits follow [Conventional Commits](https://www.conventionalcommits.org/) format: `type(scope): description`. A `commitlint` hook enforces this on every commit. See the [Commit Standards](contributing/standards/git-commits.md) for types, scopes, and examples.

Write clear, concise descriptions in the imperative mood ("add feature" not "added feature"). A short subject line is usually sufficient; add a body if the **why** isn't obvious from the diff.

## Project Structure

```
packages/lauf/src/
├── index.ts           # CLI entrypoint (Clerc commands)
├── lauf.ts            # Public API — lauf() + re-exports z from Zod
├── types.ts           # Core type definitions
├── handlers/          # One file per CLI command (init, list, run, create)
├── lib/               # Config loading, script discovery, path resolution
└── runtime/           # Script execution (runner, executor, context)
```

## Code Style

- TypeScript, strict mode
- Formatting and linting are handled by [OXC](https://oxc.rs/) (oxfmt + oxlint) — run `pnpm fmt` and `pnpm lint:fix` to auto-fix
- Prefer pure functions and immutable data
- Avoid classes, `let`, and imperative mutation where possible

## Detailed Docs

For in-depth standards, architecture concepts, and step-by-step guides, see the [`contributing/`](contributing/README.md) directory.

## Reporting Issues

Use [GitHub Issues](https://github.com/zrosenbauer/lauf/issues) to report bugs or suggest features. When filing a bug, include:

- Steps to reproduce
- Expected vs actual behavior
- Node.js and pnpm versions
- Relevant error output

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
