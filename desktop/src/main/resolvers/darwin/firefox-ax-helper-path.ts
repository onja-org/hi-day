import { join } from 'node:path';

/**
 * Path to the compiled firefox-ax-helper Swift binary — a separately-built
 * executable bundled via extraResources, so it needs a dev-vs-packaged branch.
 *
 * This resolver runs under ELECTRON_RUN_AS_NODE, a plain Node process, so
 * `app.isPackaged` and `process.resourcesPath` are unavailable here; main.ts
 * passes the equivalent in via environment variables.
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
