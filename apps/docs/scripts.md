# Writing Scripts

Scripts are TypeScript files that default-export a call to `lauf()`. Each script defines its description, typed arguments, and a `run` function.

## The `lauf()` Function

```ts
import { lauf, z } from 'laufen';

export default lauf({
  description: 'Generate TypeScript types from templates',
  args: {
    outDir: z.string().default('./src/generated'),
    verbose: z.boolean().default(false),
  },
  async run(ctx) {
    ctx.spinner.start('Generating types...');
    // ... your logic
    ctx.spinner.stop('Done');
    ctx.logger.success(`Output written to ${ctx.args.outDir}`);
  },
});
```

`lauf()` returns your config with full type inference. The `args` object uses Zod schemas -- keys become CLI flag names, and `ctx.args` is fully typed based on your schema.

### Parameters

| Property      | Type                                                                | Description                                                     |
| ------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `description` | `string`                                                            | Human-readable description shown in `lauf list` and `lauf info` |
| `args`        | `Record<string, z.ZodType>`                                         | Zod schemas for each argument                                   |
| `env`         | `Record<string, string>`                                            | Script-level environment variables (optional)                   |
| `run`         | `(ctx: ScriptContext) => void \| number \| Promise<void \| number>` | The script's entry point                                        |

## Defining Arguments with Zod

Arguments are defined as a record of Zod schemas. Each key becomes a CLI flag name:

```ts
args: {
  name: z.string(),                          // --name=value (required)
  count: z.number().default(1),              // --count=5 (optional, defaults to 1)
  verbose: z.boolean().default(false),       // --verbose (flag, defaults to false)
  tags: z.string().default('a,b'),           // --tags=x,y (string, parse in run())
}
```

Use `.describe()` to add help text shown by `lauf info`:

```ts
args: {
  outDir: z.string().default('./src').describe('Output directory for generated files'),
  dryRun: z.boolean().default(false).describe('Preview changes without writing'),
}
```

CLI values are automatically coerced: `"true"` / `"false"` become booleans, numeric strings become numbers, everything else stays a string.

## The Script Context

Every script's `run` function receives a context object:

| Property     | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| `args`       | Parsed and validated arguments, fully typed from your Zod schema |
| `env`        | Resolved environment variables (frozen `Record<string, string>`) |
| `root`       | Absolute path to the workspace root                              |
| `packageDir` | Absolute path to the containing package                          |
| `name`       | Qualified script name (e.g., `@org/pkg/my-script`)               |
| `logger`     | Structured terminal output                                       |
| `spinner`    | Progress indicator                                               |
| `prompts`    | Interactive prompts                                              |

## Logger

The logger provides structured terminal output:

```ts
ctx.logger.info('Processing files...');
ctx.logger.warn('No config found, using defaults');
ctx.logger.error('Failed to connect to database');
ctx.logger.success('Build completed');
ctx.logger.message('Plain output');
ctx.logger.newlines(2); // print 2 blank lines
```

| Method       | Description                    |
| ------------ | ------------------------------ |
| `info()`     | Informational message          |
| `warn()`     | Warning message                |
| `error()`    | Error message                  |
| `success()`  | Success message                |
| `message()`  | Plain message                  |
| `newlines()` | Print blank lines (default: 1) |

## Spinner

The spinner shows progress for long-running operations:

```ts
ctx.spinner.start('Downloading assets...');
// ... async work
ctx.spinner.message('Processing assets...');
// ... more work
ctx.spinner.stop('Assets ready');
```

| Method      | Description                                |
| ----------- | ------------------------------------------ |
| `start()`   | Start the spinner with an optional message |
| `stop()`    | Stop the spinner with an optional message  |
| `message()` | Update the spinner message while running   |

## Prompts

Interactive prompts for gathering user input. Each method returns a result tuple: `[null, value]` on success, or `[error, null]` if the user cancels.

```ts
const [err, name] = await ctx.prompts.text({
  message: 'What is your name?',
  placeholder: 'world',
});

if (err) {
  ctx.logger.warn('Cancelled');
  return;
}

ctx.logger.success(`Hello, ${name}!`);
```

### Available Prompts

#### `text`

```ts
await ctx.prompts.text({
  message: 'Enter a value',
  placeholder: 'default hint',
  defaultValue: 'fallback',
  initialValue: 'prefilled',
  validate: (value) => (value ? undefined : 'Required'),
});
```

#### `confirm`

```ts
await ctx.prompts.confirm({
  message: 'Continue?',
  active: 'Yes',
  inactive: 'No',
  initialValue: true,
});
```

#### `select`

```ts
await ctx.prompts.select({
  message: 'Pick a framework',
  options: [
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'svelte', label: 'Svelte', hint: 'recommended' },
  ],
});
```

#### `multiselect`

```ts
await ctx.prompts.multiselect({
  message: 'Select features',
  options: [
    { value: 'auth', label: 'Authentication' },
    { value: 'db', label: 'Database' },
    { value: 'cache', label: 'Caching' },
  ],
  required: true,
});
```

#### `password`

```ts
await ctx.prompts.password({
  message: 'Enter your API key',
  mask: '*',
});
```

#### `path`

```ts
await ctx.prompts.path({
  message: 'Select output directory',
  root: ctx.packageDir,
  directory: true,
});
```

## Script Naming Convention

Scripts live in a `scripts/` directory (or whatever your config specifies) inside any workspace package. They are referenced by their qualified name:

```
<package-name>/<script-stem>
```

For example, given this structure:

```
packages/
  api/
    package.json        # name: "@my-org/api"
    scripts/
      generate-types.ts
  web/
    package.json        # name: "@my-org/web"
    scripts/
      build-icons.ts
```

The qualified names are:

- `@my-org/api/generate-types`
- `@my-org/web/build-icons`

The script stem is the filename without the `.ts` extension.
