---
'@laufen/engine': patch
'laufen': patch
---

Fix `laufen info <script>` and `laufen run <script> --help` failing in two ways:

- Add `createRequire` banner to esbuild bundled output so CJS dependencies (e.g. `dotenv`) work inside ESM bundles without crashing on "Dynamic require of 'fs' is not supported".
- Pre-process argv to detect `run <script> --help` and strip the help flag before Clerc parses, preventing Clerc's global `helpPlugin` from intercepting and showing generic command help instead of script-level help.
- Render single-package `lauf list` output with the package name as a header instead of a nested `└──` branch.
- Add trailing newline to help output for better CLI readability.
