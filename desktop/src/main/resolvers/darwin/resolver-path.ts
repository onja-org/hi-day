import { join } from 'node:path';

/**
 * Resolves the path to darwin's resolver entry point (index.ts, compiled
 * to index.js). Unlike win-resolver.exe, this is a plain JS file compiled
 * as part of the desktop app's own build — not a separately-built native
 * binary — so it's run via Electron's own executable acting as a plain
 * Node process (ELECTRON_RUN_AS_NODE=1 in the spawned child's env; see
 * resolver-manager.ts's ResolverSpawnConfig.env), not spawned directly.
 *
 * Correct for dev and a plain `pnpm build` output, since both put
 * dist/main (or src/main) at a fixed depth from this file's own location.
 * Correct for a packaged app too, unlike win32/resolver-path.ts's
 * equivalent — this file lives inside the app's own asar-packed dist/main
 * output (compiled TypeScript, not a separately bundled native resource),
 * so __dirname resolves correctly in every case without a
 * process.resourcesPath branch.
 */
const RESOLVER_ENTRY_POINT = join(__dirname, 'index.js');

export function resolveDarwinResolverPath(): string {
  return RESOLVER_ENTRY_POINT;
}
