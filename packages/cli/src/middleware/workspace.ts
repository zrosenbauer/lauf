import { decorateContext, middleware } from '@kidd-cli/core';
import type { CachedWorkspaceState } from '@laufen/config/workspace';
import { getWorkspaceState } from '@laufen/config/workspace';

type WorkspaceEnv = { Variables: { workspace: CachedWorkspaceState } };
type Middleware<TEnv extends { Variables?: Record<string, unknown> }> = ReturnType<
  typeof middleware<TEnv>
>;

declare module '@kidd-cli/core' {
  interface CommandContext {
    /**
     * Cached workspace state computed once at the start of every command.
     *
     * Includes the resolved root boundary, the workspace the user is
     * currently inside (`current`), and the full tree of discovered
     * workspaces. Avoids each command independently calling
     * `getWorkspaceState(process.cwd())`.
     */
    readonly workspace: CachedWorkspaceState;
  }
}

/**
 * Global middleware: resolve workspace state once and attach it to ctx.
 */
export const workspaceMiddleware: Middleware<WorkspaceEnv> = middleware<WorkspaceEnv>(
  async (ctx, next) => {
    const state = getWorkspaceState(process.cwd());
    decorateContext(ctx, 'workspace', state);
    await next();
  },
);
