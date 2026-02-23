---
'laufen': minor
---

Initial release of lauf — a typed script runner for monorepos. Discover, validate, and execute TypeScript scripts with Zod-powered arguments.

- **Config-driven** — `lauf.config.ts` at your workspace root defines script glob patterns and optional logger overrides; scaffold one with `lauf init`
- **Workspace-agnostic** — auto-detects pnpm, npm, yarn, bun, lerna, and single-package projects
- **Automatic script discovery** — scans every workspace package for scripts matching configured patterns
- **Zod-powered validation** — define arguments with Zod schemas for runtime validation and full TypeScript inference; CLI flags are automatically coerced to correct types
- **Isolated execution** — each script runs in its own child process via `tsx`
- **Rich script context** — every script receives a logger, spinner, and interactive prompts (text, confirm, select, multiselect, password, path) powered by `@clack/prompts`
- **Built-in scaffolding** — `lauf create` generates a ready-to-run script from a starter template
- **Script help** — `lauf info` displays a script's typed arguments, descriptions, and defaults without executing it
- **Tiny API surface** — one function (`lauf()`), one schema library (`z`), one convention (`scripts/` directory)
