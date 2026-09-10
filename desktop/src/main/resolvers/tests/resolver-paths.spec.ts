import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveDarwinResolverPath,
  resolveLinuxResolverPath,
  resolveWinResolverPath,
} from '../resolver-paths';

/**
 * These run from `src/`, not `dist/`, so the returned paths point at
 * source-tree equivalents rather than build output. That is exactly what
 * makes them useful: the `..`-depth arithmetic is identical either way, so
 * asserting that each path lands on a directory that REALLY EXISTS catches
 * an off-by-one-directory mistake — the bug that shipped in the previous
 * per-platform version of this module, where only the filename was
 * asserted and the wrong depth went unnoticed.
 */
const repoRoot = join(__dirname, '..', '..', '..', '..', '..');

describe('resolver entry-point paths', () => {
  it('points darwin at its sibling resolver directory', () => {
    const path = resolveDarwinResolverPath();
    expect(path.endsWith(join('resolvers', 'darwin', 'index.js'))).toBe(true);
    // The directory it lives in must exist — proves the depth is right.
    expect(existsSync(join(path, '..'))).toBe(true);
  });

  it('points linux at its sibling resolver directory', () => {
    const path = resolveLinuxResolverPath();
    expect(path.endsWith(join('resolvers', 'linux', 'index.js'))).toBe(true);
    expect(existsSync(join(path, '..'))).toBe(true);
  });

  it("resolves win32's dev path inside the repo's real native/win tree, not desktop/native", () => {
    const path = resolveWinResolverPath({ isPackaged: false, resourcesPath: '/should/not/appear' });

    expect(path).not.toContain('/should/not/appear');
    expect(path.endsWith('win-resolver.exe')).toBe(true);
    // The regression guard: native/win/resolver is at the REPO ROOT, while
    // native/darwin sits under desktop/. Getting this wrong made dev-mode
    // Windows silently unable to find the side-car it had just built.
    expect(path.startsWith(join(repoRoot, 'native', 'win'))).toBe(true);
    expect(existsSync(join(repoRoot, 'native', 'win', 'resolver'))).toBe(true);
  });

  it('resolves win32 under resourcesPath when packaged', () => {
    const path = resolveWinResolverPath({
      isPackaged: true,
      resourcesPath: '/Applications/App.app/Contents/Resources',
    });

    expect(path).toBe('/Applications/App.app/Contents/Resources/native/win/resolver/win-resolver.exe');
  });
});
