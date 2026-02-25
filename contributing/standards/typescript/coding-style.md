# Coding Style

## Overview

High-level constraints that govern all TypeScript in the monorepo. These rules are enforced by OXLint and OXFmt — code that violates them will not pass CI. The goal is a strict functional style: pure, immutable, declarative, with side effects pushed to the edges.

## Rules

### No `let` — Use `const` Only

All bindings must be `const`. No reassignment, no mutation. Mutable state inside closures (factory internals) is the one accepted exception.

#### Correct

```ts
const timeout = 5000;
const scripts = config.scripts.filter(isEnabled);
```

#### Incorrect

```ts
let timeout = 5000;
timeout = 10000;

let scripts: Script[] = [];
scripts.push(newScript);
```

### No Loops

Use `map`, `filter`, `reduce`, `flatMap`, and `es-toolkit` utilities instead of `for`, `while`, `do...while`, `for...in`, or `for...of`.

#### Correct

```ts
const names = scripts.map((s) => s.name);
const enabled = scripts.filter((s) => s.enabled);
const total = items.reduce((sum, item) => sum + item.count, 0);
```

#### Incorrect

```ts
const names: string[] = [];
for (const script of scripts) {
  names.push(script.name);
}
```

### No Classes

Use plain objects, closures, and factory functions. Classes are permitted only when wrapping an external SDK that requires instantiation.

| Anti-pattern              | Use Instead                |
| ------------------------- | -------------------------- |
| Utility classes           | Module with functions      |
| Static method collections | Module with functions      |
| Data containers           | Plain objects / interfaces |
| Singletons                | Module-level constants     |

#### Correct

```ts
export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

#### Incorrect

```ts
class StringUtils {
  static capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
```

### No `this`

Never reference `this`. Factory closures and plain functions eliminate the need.

### No `throw`

Return errors as values using the `Result` tuple type. No `throw` statements or throw expressions.

#### Correct

```ts
function parseConfig(raw: string): Result<Config, ParseError> {
  if (!raw) {
    return [{ type: 'parse_error', message: 'Empty input' }, null];
  }
  return [null, JSON.parse(raw)];
}
```

#### Incorrect

```ts
function parseConfig(raw: string): Config {
  if (!raw) {
    throw new Error('Empty input');
  }
  return JSON.parse(raw);
}
```

### Immutable Data

Do not mutate objects or arrays after creation. Return new values from every transformation.

#### Correct

```ts
function addScript(scripts: readonly Script[], script: Script): readonly Script[] {
  return [...scripts, script];
}
```

#### Incorrect

```ts
function addScript(scripts: Script[], script: Script) {
  scripts.push(script);
}
```

### No Ternaries

Use `if`/`else` or `match` expressions. Ternaries are banned by the linter.

#### Correct

```ts
if (isVerbose) {
  log.info(details);
} else {
  log.info(summary);
}
```

#### Incorrect

```ts
const message = isVerbose ? details : summary;
```

### No Optional Chaining

Use explicit `if`/`else` or pattern matching instead of `?.`.

#### Correct

```ts
if (config.scripts) {
  runAll(config.scripts);
}
```

#### Incorrect

```ts
config.scripts?.forEach(run);
```

### No `any`

Use `unknown`, generics, or proper types. Narrow with type guards when needed.

#### Correct

```ts
function parse(data: unknown): Result<Config, ParseError> {
  if (!isPlainObject(data)) {
    return [{ type: 'parse_error', message: 'Expected object' }, null];
  }
  return [null, validateConfig(data)];
}
```

#### Incorrect

```ts
function parse(data: any): Config {
  return data;
}
```

### Prefer Point-Free Style

When passing a named function to a higher-order function, pass it directly instead of wrapping in an arrow.

#### Correct

```ts
const valid = scripts.filter(isEnabled);
const names = items.map(getName);
```

#### Incorrect

```ts
const valid = scripts.filter((s) => isEnabled(s));
const names = items.map((item) => getName(item));
```

### ESM Only

Use ES module syntax with `verbatimModuleSyntax`. Use `import type` for type-only imports. Prefer the `node:` protocol for Node.js builtins.

#### Correct

```ts
import type { Config } from './types';
import { readFile } from 'node:fs/promises';
import { loadConfig } from './lib/config';
```

#### Incorrect

```ts
const fs = require('fs');
import { Config } from './types'; // should use import type
import { readFile } from 'fs'; // should use node: protocol
```

## References

- [Design Patterns](./design-patterns.md) -- Factories, pipelines, composition
- [Errors](./errors.md) -- Result type for error handling
- [State](./state.md) -- Immutable state management
- [Functions](./functions.md) -- Pure functions and composition
