import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** scripts/ -> desktop/. From this file, not the pack context, whose type eslint cannot resolve. */
const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * The side-car a platform must have before it can be packaged, or null when it
 * needs none — Linux's resolver is compiled TypeScript in dist/, built by
 * `pnpm build` with the rest of the app.
 *
 * The win32 path climbs out of desktop/ because that resolver lives at the repo
 * root while the darwin helper lives under desktop/. Getting that wrong is not
 * hypothetical: electron-builder's own extraResources entry omitted the ../ and
 * would have bundled nothing.
 *
 * @param {string} platform electronPlatformName
 * @returns {{ path: string, build: string } | null}
 */
export function requirementFor(platform) {
  if (platform === 'win32') {
    return {
      path: join(desktopDir, '../native/win/resolver/WinResolver/bin/Release/net8.0-windows/win-x64/publish/win-resolver.exe'),
      build: 'pnpm --filter desktop build:resolver:win',
    };
  }
  if (platform === 'darwin') {
    return {
      path: join(desktopDir, 'native/darwin/firefox-ax-helper'),
      build: 'pnpm --filter desktop build:resolver:mac',
    };
  }
  return null;
}

/**
 * Which of the two required architectures `lipo -info` does not report.
 *
 * Both forms matter. A universal binary prints "Architectures in the fat file:
 * ... are: x86_64 arm64", while a single-slice one prints "Non-fat file: ... is
 * architecture: x86_64" — the second is what build.sh --native produces, and
 * what was nearly shipped.
 *
 * @param {string} lipoOutput
 * @returns {string[]}
 */
export function missingArchitectures(lipoOutput) {
  return ['x86_64', 'arm64'].filter((arch) => !lipoOutput.includes(arch));
}

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
  const expected = requirementFor(context.electronPlatformName);
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
    const missing = missingArchitectures(info);
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
