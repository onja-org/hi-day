import { join } from 'node:path';

/**
 * Resolves the path to the compiled firefox-ax-helper Swift binary.
 * Unlike resolver-path.ts (this resolver's own entry point, resolved via
 * plain __dirname since it's compiled TypeScript inside the app's own
 * dist/main), this binary is a separately-built native executable bundled
 * via electron-builder's extraResources (see electron-builder.yml) — so
 * it needs the same dev-vs-packaged branch win32/resolver-path.ts uses.
 *
 * The catch this file exists to solve: this whole resolver process runs
 * via ELECTRON_RUN_AS_NODE (see main.ts) — a plain Node process, not
 * Electron's main process — so `app.isPackaged`/`process.resourcesPath`
 * are simply unavailable here directly. main.ts passes the equivalent
 * information in via environment variables instead (see resolver-path.ts's
 * sibling in win32 for the parallel non-nested case, which doesn't need
 * this because it has no further child process of its own to resolve a
 * path for).
 */
const DEV_PATH = join(__dirname, '../../../../native/darwin/firefox-ax-helper');

export interface ResolveFirefoxAxHelperPathOptions {
  isPackaged: boolean;
  resourcesPath: string | undefined;
}

export function resolveFirefoxAxHelperPath(options: ResolveFirefoxAxHelperPathOptions): string {
  if (options.isPackaged && options.resourcesPath) {
    return join(options.resourcesPath, 'native', 'darwin', 'firefox-ax-helper');
  }
  return DEV_PATH;
}

/** Reads the env vars main.ts sets when spawning this resolver — see resolverSpawnConfigForPlatform. */
export function resolveFirefoxAxHelperPathFromEnv(): string {
  return resolveFirefoxAxHelperPath({
    isPackaged: process.env.RESOLVER_IS_PACKAGED === '1',
    resourcesPath: process.env.RESOLVER_RESOURCES_PATH,
  });
}
