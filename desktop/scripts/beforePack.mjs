import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** scripts/ -> desktop/. From this file, not the pack context, whose type eslint cannot resolve. */
const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Fails the build when the platform's resolver side-car is missing or unusable.
 *
 * Both side-cars are gitignored artifacts built by toolchains electron-builder
 * does not drive, so a release once shipped with extraResources empty: the
 * installer built, installed and launched, and only URL tracking was dead. The
 * dist:* scripts build them first; this catches the case those are bypassed.
 *
 * @param {{ electronPlatformName: string }} context
 * @throws if the side-car is absent, or on macOS not universal.
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

  // Linux's resolver is compiled TypeScript in dist/ — no separate artifact.
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

  // One helper file is bundled into both the x64 and arm64 builds, so an
  // Intel-only binary — what build.sh --native produces — silently breaks
  // Firefox tracking for every Apple Silicon user.
  if (context.electronPlatformName === 'darwin') {
    const info = execFileSync('lipo', ['-info', expected.path], { encoding: 'utf-8' });
    const missing = ['x86_64', 'arm64'].filter((arch) => !info.includes(arch));
    if (missing.length > 0) {
      throw new Error(
        `firefox-ax-helper is not universal — missing ${missing.join(' and ')}.\n` +
          `  ${info.trim()}\n` +
          `Rebuild without --native:\n  ${expected.build}\n` +
          'Shipping this would break Firefox URL tracking on the architectures it omits.',
      );
    }
  }
}
