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
