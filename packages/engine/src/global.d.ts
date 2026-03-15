/**
 * Global namespace for package type registry.
 *
 * This provides a default empty registry that gets augmented when
 * `.lauf/packages.d.ts` is generated.
 */
declare global {
  namespace LaufPackages {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Registry {}
  }
}

export {};
