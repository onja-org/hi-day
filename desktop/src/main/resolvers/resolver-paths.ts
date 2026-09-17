import { join } from 'node:path';

/**
 * Where each platform's resolver side-car lives, in one place.
 *
 * Previously one file per platform, which is how a real bug survived: the
 * Windows dev path counted `..` segments as though `native/win/` sat under
 * `desktop/` (the way `desktop/native/darwin/` genuinely does), when it is
 * actually at the repo root. Dev-mode Windows therefore looked for
 * win-resolver.exe one directory too shallow and never found it — and the
 * per-platform test only asserted the filename, so nothing caught it.
 * Co-locating the three makes the differing layouts visible side by side,
 * and `resolver-paths.spec.ts` now asserts the dev paths against the real
 * repository layout rather than just their suffix.
 *
 * Two different shapes here, for a real reason:
 *   - darwin and linux resolvers are compiled TypeScript inside the app's
 *     own `dist/main/`, so `__dirname` is correct in dev and packaged
 *     alike, with no branch.
 *   - win32's is a separately-built native .exe bundled through
 *     electron-builder `extraResources`, so it needs the dev-vs-packaged
 *     branch: inside a packaged app it lives under `process.resourcesPath`,
 *     not anywhere reachable by walking up from `__dirname` in the asar.
 */

/** This file compiles to `dist/main/resolvers/`, so `__dirname` is the resolvers directory. */
const RESOLVERS_DIR = __dirname;

/** `dist/main/resolvers` → up four is the repo root, where `native/` lives. */
const REPO_ROOT_FROM_RESOLVERS = join(RESOLVERS_DIR, '..', '..', '..', '..');

export function resolveDarwinResolverPath(): string {
  return join(RESOLVERS_DIR, 'darwin', 'index.js');
}

export function resolveLinuxResolverPath(): string {
  return join(RESOLVERS_DIR, 'linux', 'index.js');
}

export interface ResolveWinResolverPathOptions {
  isPackaged: boolean;
  resourcesPath: string;
}

export function resolveWinResolverPath(options: ResolveWinResolverPathOptions): string {
  if (options.isPackaged) {
    return join(options.resourcesPath, 'native', 'win', 'resolver', 'win-resolver.exe');
  }
  return join(
    REPO_ROOT_FROM_RESOLVERS,
    'native/win/resolver/WinResolver/bin/Release/net8.0-windows/win-x64/win-resolver.exe',
  );
}
