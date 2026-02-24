/**
 * A script discovered during workspace scanning.
 *
 * Extends the engine's `ScriptTarget` with additional discovery metadata.
 */
export interface DiscoveredScript {
  /**
   * Qualified name: <package-name>/<script-stem>
   */
  readonly name: string;
  /**
   * Absolute path to the script file
   */
  readonly path: string;
  /**
   * Absolute path to the containing package
   */
  readonly packageDir: string;
  /**
   * Package name from package.json
   */
  readonly packageName: string;
}
