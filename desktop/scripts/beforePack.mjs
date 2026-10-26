import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** scripts/ -> desktop/. From this file, not the pack context, whose type eslint cannot resolve. */
const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * The side-car a platform must have before it can be packaged, or null when it
 * needs none — Linux's resolver is compiled TypeScript in dist/, built by
 * `pnpm build` with the rest of the app.
 *
 * `alongside` names the data files the side-car reads from its own directory,
 * which electron-builder copies wholesale with the binary. They are as required
 * as the binary: without them the side-car starts and dies on its first read.
 *
 * The win32 path climbs out of desktop/ because that resolver lives at the repo
 * root while the darwin helper lives under desktop/. Getting that wrong is not
 * hypothetical: electron-builder's own extraResources entry omitted the ../ and
 * would have bundled nothing.
 *
 * @param {string} platform electronPlatformName
 * @returns {{ path: string, alongside: string[], build: string } | null}
 */
export function requirementFor(platform) {
  if (platform === 'win32') {
    return {
      path: join(desktopDir, '../native/win/resolver/WinResolver/bin/Release/net8.0-windows/win-x64/publish/win-resolver.exe'),
      // WinResolver.csproj links both of these in as <None> items, and the
      // resolver opens them at startup before answering anything. v0.3.8 exists
      // because a publish output that had the .exe and neither JSON passed this
      // guard and shipped: the Windows resolver threw FileNotFoundException on
      // launch, so no Windows machine on v0.3.7 recorded a single URL while app
      // tracking, which uses another path entirely, kept working.
      alongside: ['browser-registry.json', 'firefox-private-markers.json'],
      build: 'pnpm --filter desktop build:resolver:win',
    };
  }
  if (platform === 'darwin') {
    return {
      path: join(desktopDir, 'native/darwin/firefox-ax-helper'),
      // None: this helper reads no file from its own directory. The marker
      // table it works from is read by FirefoxAxResolver on the Electron side,
      // out of dist/, where copy-assets.mjs puts it.
      alongside: [],
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
 * Which of a side-car's required data files are not next to it.
 *
 * Split out from the hook so it can be tested without a publish directory, and
 * because a partial publish output is its own failure: the side-car's own
 * toolchain decides whether these land beside the binary, and it has been seen
 * writing one without the others.
 *
 * @param {{ path: string, alongside: string[] }} required
 * @returns {string[]}
 */
export function missingDataFiles(required) {
  const beside = dirname(required.path);
  return required.alongside.filter((file) => !existsSync(join(beside, file)));
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
 * @throws if the side-car is absent or incomplete, or on macOS not universal.
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

  // The binary alone is not enough. v0.3.7's Windows publish output had
  // win-resolver.exe and neither of its JSON files, so the installer packaged,
  // installed and launched with URL tracking dead on arrival — the same silent
  // failure as the empty extraResources above, one level further in.
  const incomplete = missingDataFiles(expected);
  if (incomplete.length > 0) {
    throw new Error(
      `Resolver side-car for ${context.electronPlatformName} is missing its data ` +
        `${incomplete.length === 1 ? 'file' : 'files'}:\n` +
        incomplete.map((file) => `  ${join(dirname(expected.path), file)}`).join('\n') +
        `\n${basename(expected.path)} reads ${incomplete.length === 1 ? 'it' : 'them'} at startup and ` +
        'exits without it, so packaging this produces an installer whose URL tracking ' +
        `never starts.\nRebuild the side-car from a clean output:\n  ${expected.build}\n`,
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
