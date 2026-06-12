---
'laufen': minor
---

Redesign workspace detection to use lauf.config.ts files as the sole workspace boundary, replacing package manager detection (pnpm-workspace.yaml, etc.).

- Workspaces are now defined by the presence of `lauf.config.ts` files
- Added `root: true` config option to mark the workspace root boundary
- Root resolution walks up from cwd: `root: true` config → `.git` directory → cap fallback
- Bare script names now resolve against the current workspace first, fixing the bug where a root script shadowed a nested workspace script with the same name
- New `lib/workspace/` module with walk, root, discovery, resolve, scripts, and cache sub-modules
- Removed old `lib/workspace.ts`, `lib/discovery.ts`, and `lib/config-discovery.ts`
- **Breaking:** default script glob widened from `scripts/*.lauf.ts` to `scripts/*.ts`. Any `.ts` file under `scripts/` is now picked up by default. Projects that relied on the explicit `.lauf.ts` opt-in should set `scripts: ['scripts/*.lauf.ts']` in their config.
