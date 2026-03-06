/**
 * Filesystem helper utilities scoped to a package directory.
 *
 * All path arguments are resolved relative to the package directory.
 */
export interface FsHelpers {
  /**
   * Read file contents. Paths resolved relative to package directory.
   */
  readonly readFile: (filePath: string, encoding?: BufferEncoding) => Promise<string | Buffer>;

  /**
   * Write file contents. Creates parent directories if needed.
   */
  readonly writeFile: (filePath: string, data: string | Buffer) => Promise<void>;

  /**
   * Copy file from source to destination.
   */
  readonly copyFile: (src: string, dest: string) => Promise<void>;

  /**
   * Create directory recursively.
   */
  readonly mkdir: (dirPath: string) => Promise<void>;

  /**
   * Remove file or directory recursively.
   */
  readonly rm: (targetPath: string) => Promise<void>;

  /**
   * Check if path exists.
   */
  readonly exists: (filePath: string) => Promise<boolean>;

  /**
   * Get file stats.
   */
  readonly stat: (filePath: string) => Promise<{
    readonly isFile: () => boolean;
    readonly isDirectory: () => boolean;
    readonly size: number;
    readonly mtime: Date;
  }>;
}
