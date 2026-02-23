/**
 * A script discovered during workspace scanning.
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

/**
 * Result of executing a script.
 */
export interface RunResult {
  /**
   * Process exit code (0 = success).
   */
  readonly exitCode: number;
  /**
   * The script that was executed.
   */
  readonly script: DiscoveredScript;
}
