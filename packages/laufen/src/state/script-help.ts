/**
 * Module-level flag to signal that `run <script> --help` was detected
 * and the help flag was stripped from argv before Clerc parsed it.
 *
 * This lets the run handler know it should enter help mode even though
 * `--help` is no longer present in the raw argv.
 */

let requested = false;

export function markScriptHelpRequested(): void {
  requested = true;
}

export function consumeScriptHelpRequested(): boolean {
  const wasRequested = requested;
  requested = false;
  return wasRequested;
}
