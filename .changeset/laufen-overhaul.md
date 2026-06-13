---
'laufen': minor
---

Overhaul the laufen CLI internals: swap Clerc for `@kidd-cli/core`, replace `node:path` with `pathe`, `fast-glob` with `tinyglobby`, and lift workspace-state resolution into a shared kidd middleware.

- **CLI framework:** Drop Clerc + the home-grown `defineHandler` shim. The 6 commands (`init`, `list`, `info`, `run`, `create`, `blueprint`) are now defined via `command({...})` from `@kidd-cli/core`, with Zod-based `options`/`positionals` and direct use of `ctx.fail` / `ctx.log` / `ctx.prompts` / `ctx.colors`. The new entrypoint is a thin `cli({...})` call. Deletes `lib/handler.ts`, `utils/prompt.ts`, `utils/prompt-args.ts`, `utils/schema.ts`, `utils/help-rewrite.ts`, `state/script-help.ts`, and the old `handlers/` dir.
- **Workspace middleware:** A new global middleware (`middleware/workspace.ts`) resolves the workspace state once per invocation and decorates `ctx.workspace`, replacing the duplicate `getWorkspaceState(process.cwd())` calls that lived in every command.
- **Cross-platform paths:** All `node:path` imports replaced with `pathe` across both `laufen` and `engine` (28 files). Same API surface, normalized forward-slash semantics on Windows.
- **Faster globbing:** `fast-glob` swapped for `tinyglobby` (~3× faster, smaller install) in `lib/workspace/discovery.ts` and `lib/workspace/scripts.ts`.
- **Result helper:** New `assertOk(result, ctx.fail, prefix)` assertion on the existing tuple `Result` type — lifts kidd's `ctx.fail` into a typed assertion so the value side is narrowed without manual casts.
- **Peers:** Added `react` and `ink` as direct deps since `@kidd-cli/core` requires them at module-resolution time even when only the non-UI surface is used.

No public API changes (`lauf()` / `defineConfig()` exports and the script-side `ScriptContext` are unchanged). External CLI behavior is preserved: same commands, same flags, same output structure.
