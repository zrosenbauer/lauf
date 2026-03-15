---
'laufen': minor
---

Add `lauf blueprint` command for scaffolding pre-built script templates

- `lauf blueprint` lists available blueprints
- `lauf blueprint <name>` scaffolds a blueprint into the project's scripts directory
- Available blueprints: `clean` (remove build artifacts and caches) and `copy` (copy files matching glob patterns)
- `clean` supports `--build`, `--cache`, `--npm`, `--nuke`, and `--dryRun` flags for granular control
- `copy` uses a configurable `COPY_PATTERNS` constant and supports `--to` and `--dryRun` flags
