---
'laufen': patch
---

fix: skip prompting for args with Zod `.default()` values

Zod 4's `toJSONSchema()` includes defaulted fields in the `required` array, which caused the CLI to prompt for args that already have defaults. The prompt filter now checks for a `default` key in the JSON Schema property and skips those fields, letting `safeParse()` apply the default during validation.
