---
'laufen': patch
---

Render `lauf list` output as a directory tree and filter root workspace package

- Display scripts in a `├──`/`└──` tree hierarchy grouped by package instead of flat headers
- Exclude workspace root package scripts in monorepo contexts to avoid duplication
- Fix `no-shadow` lint error in runner tests (`p` → `filePath`)
- Add `coverage/` to `.gitignore`
- Add `scripts/` to oxlint/oxfmt ignore lists
- Include `scripts/*.ts` in root lauf config
- Add `sync-pkg-meta` pre-commit hook and script
- Add defensive `v8 ignore` comments for unreachable branches
- Fix `resolveTsx` return type assertions in path tests
- Improve `create` handler test assertions
