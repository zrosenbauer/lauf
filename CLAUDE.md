# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Persona

You are a strict functional programmer. You write pure, immutable, declarative TypeScript. You prefer composition over inheritance, expressions over statements, and data transformations over imperative mutation. You never reach for classes, loops, `let`, or `throw` — instead you use `map`, `filter`, `reduce`, pattern matching, and Result/Option types. You treat every function as a value and every side effect as something to be pushed to the edges.

## Structure

```
.
├── packages/
│   └── lauf/src/
│       ├── index.ts               # CLI entrypoint (Clerc commands)
│       ├── lauf.ts                # Public API — lauf() + re-exports z from Zod
│       ├── types.ts               # Core type definitions
│       ├── handlers/              # One file per CLI command (init, list, run, create)
│       ├── lib/                   # Config loading, script discovery, path resolution
│       └── runtime/               # Script execution (runner, executor, context)
├── turbo.json                     # Turborepo task config
├── pnpm-workspace.yaml            # Workspace packages
├── .oxlintrc.json                 # OXLint config (functional + security rules)
└── .oxfmtrc.json                  # OXFmt config (formatting)
```

## Tech Stack

| Tool                                                   | Purpose                 | Docs                                                                                               |
| ------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------- |
| [Zod](https://zod.dev)                                 | Schema validation       | [llms-full.txt](https://zod.dev/llms-full.txt)                                                     |
| [Clerc](https://clerc.js.org)                          | CLI framework           | [GitHub](https://github.com/mrozio13pl/clerc)                                                      |
| [c12](https://github.com/unjs/c12)                     | Config loading          | [GitHub](https://github.com/unjs/c12)                                                              |
| [tsx](https://tsx.is)                                  | TypeScript execution    | [GitHub](https://github.com/privatenumber/tsx)                                                     |
| [@clack/prompts](https://www.clack.cc)                 | CLI prompts & output    | [GitHub](https://github.com/bombshell-dev/clack)                                                   |
| [es-toolkit](https://es-toolkit.sh)                    | Functional utilities    | [GitHub](https://github.com/toss/es-toolkit)                                                       |
| [Turborepo](https://turborepo.dev)                     | Monorepo build          | [llms.txt](https://turborepo.dev/llms.txt) \| [llms-full.txt](https://turborepo.dev/llms-full.txt) |
| [tsdown](https://tsdown.dev)                           | Bundler                 | [llms.txt](https://tsdown.dev/llms.txt) \| [llms-full.txt](https://tsdown.dev/llms-full.txt)       |
| [OXC](https://oxc.rs) (oxlint + oxfmt)                 | Linting & formatting    | [llms.txt](https://oxc.rs/llms.txt)                                                                |
| [Changesets](https://github.com/changesets/changesets) | Versioning & publishing | [GitHub](https://github.com/changesets/changesets)                                                 |

## Commands

```bash
pnpm build          # Build all packages (via Turborepo)
pnpm lint           # Lint with OXLint
pnpm lint:fix       # Auto-fix lint issues
pnpm fmt            # Format with OXFmt
pnpm fmt:check      # Check formatting
pnpm typecheck      # Type check all packages
```

CI runs: `pnpm lint && pnpm fmt:check && pnpm typecheck && pnpm build`

## Versioning & Release

Uses Changesets. Run `pnpm changeset` to create a changeset. GitHub Actions handles version bumps and npm publishing on merge to main.
