import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/ -> desktop/. Taken from this file's own location rather than from
// the pack context, whose type electron-builder does not export in a form the
// project's eslint setup can resolve.
const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Fails the build when the platform's resolver side-car is missing.
 *
 * Both side-cars are build artifacts, gitignored, and produced by toolchains
 * electron-builder does not drive — .NET for win-resolver.exe, Swift for
 * firefox-ax-helper. Nothing ever built them as part of packaging, so a release
 * shipped with the extraResources directory empty and every user hit the same
 * spawn ENOENT the first Windows run did. That is a silent failure: the
 * installer builds, installs and launches, and only URL tracking is dead.
 *
 * The dist:* scripts now build them first. This guard exists for the case those
 * are bypassed — someone running `electron-builder` directly, or a workflow
 * step that drifts — so the build stops instead of producing an installer that
 * looks fine and cannot work.
 *
 * @param {{ electronPlatformName: string }} context
 */
export default function beforePack(context) {
  /** @type {Record<string, { path: string, build: string }>} */
  const required = {
    win32: {
      path: join(desktopDir, '../native/win/resolver/WinResolver/bin/Release/net8.0-windows/win-x64/publish/win-resolver.exe'),
      build: 'pnpm --filter desktop build:resolver:win',
    },
    darwin: {
      path: join(desktopDir, 'native/darwin/firefox-ax-helper'),
      build: 'pnpm --filter desktop build:resolver:mac',
    },
  };

  // Linux's resolver is compiled TypeScript inside dist/, produced by `pnpm
  // build` like the rest of the app — there is no separate artifact to check.
  const expected = required[context.electronPlatformName];
  if (!expected) return;

  if (!existsSync(expected.path)) {
    throw new Error(
      `Resolver side-car missing for ${context.electronPlatformName}:\n` +
        `  ${expected.path}\n` +
        `Build it first:\n  ${expected.build}\n` +
        'Packaging without it produces an installer whose URL tracking cannot start.',
    );
  }
}
