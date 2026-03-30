---
'laufen': patch
---

Fix `lauf list` showing nested workspace scripts under root instead of grouped by workspace. Scripts are now re-attributed to their deepest matching workspace package, so the default view at root only shows root-level scripts and `--all` properly groups by workspace.
