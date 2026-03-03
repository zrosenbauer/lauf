---
'laufen': major
'@laufen/engine': major
---

## Consolidate env API

Consolidate the environment variable API into a single `env` field and `sandbox` boolean.

**BREAKING CHANGES**:

- `envFile` config option removed — use the `dotenv()` helper inside an `env` function instead
- `envMode` config option removed — replaced by `sandbox: boolean` (default: `true`)
- `ScriptConfig.env` now accepts a function `(ctx: EnvContext) => Record<string, string>` in addition to a static record
- `dotenv()` now returns an `EnvFn` instead of `Record<string, string>` — use `env: dotenv()` directly instead of wrapping in a function

New features:

- `sandbox` config option (`true` = isolated, `false` = full `process.env`)
- `env` accepts an async function with `EnvContext` for dynamic env resolution
- `dotenv()` standalone helper exported from `laufen` for loading `.env` files
- `EnvFn` type alias exported from both `@laufen/engine` and `laufen`
- `EnvContext` type exported from both `@laufen/engine` and `laufen`
- `resolveEnvValue()` helper exported from `@laufen/engine`
- `infisical()` helper + `InfisicalConfig` type for loading secrets from Infisical CLI

Merge priority (right wins): base (sandbox) < config `env` < script `env` < CLI `--env`
