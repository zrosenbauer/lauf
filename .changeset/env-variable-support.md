---
'laufen': major
'@laufen/engine': major
---

Add environment variable support with envFile, env, and envMode

**BREAKING CHANGE**: Scripts now run in isolated environment mode by default (`envMode: 'isolate'`), receiving only minimal env vars (PATH, HOME, TERM, SHELL, USER, LANG, TMPDIR). Previously, scripts inherited the full parent `process.env`. To restore the old behavior, set `envMode: 'inherit'` in your `lauf.config.ts`.

New features:

- `envFile` config option to load `.env` files
- `env` config option (and script-level `env`) for explicit env vars
- `envMode` config option (`'isolate'` or `'inherit'`) to control base environment
- `--env KEY=VALUE` CLI flag to pass env vars per-run
- `ctx.env` in script context for typed access to resolved env vars

Merge priority (right wins): base < envFile < config.env < script.env < CLI --env
