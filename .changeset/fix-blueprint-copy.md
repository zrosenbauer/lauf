---
'laufen': patch
---

Fix blueprint templates not being found at runtime by moving them next to the template module and using tsdown's copy feature instead of a post-build cpSync hack
