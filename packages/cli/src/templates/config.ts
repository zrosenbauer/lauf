/**
 * Template for `lauf.config.ts` — written by `lauf init`.
 */
// oxlint-disable-next-line functional/functional-parameters
export function configTemplate(): string {
  return `import { defineConfig } from 'laufen'

export default defineConfig({
  scripts: ['scripts/*.ts'],
})
`;
}
