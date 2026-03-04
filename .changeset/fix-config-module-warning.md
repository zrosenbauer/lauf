---
'laufen': patch
---

Fix MODULE_TYPELESS_PACKAGE_JSON warning when loading `.ts` config files by providing a jiti-backed import function to c12, bypassing its native `import()` attempt
