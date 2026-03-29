---
'@laufen/engine': patch
'laufen': patch
---

fix: scope script discovery to current package and resolve ctx.dir.workspace to invocation directory

- Run handler now scopes interactive script discovery to the current package (consistent with list handler)
- ctx.dir.workspace reflects the package where lauf was invoked, not the script's package directory
- Added LAUF_INVOCATION_DIR env var to pass invocation context through the execution pipeline
