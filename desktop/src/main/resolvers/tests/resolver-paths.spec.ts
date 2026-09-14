import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveLinuxResolverPath } from '../resolver-paths';

/**
 * This runs from `src/`, not `dist/`, so the returned path points at the
 * source-tree equivalent rather than build output. That is exactly what
 * makes it useful: the `..`-depth arithmetic is identical either way, so
 * asserting the path lands on a directory that REALLY EXISTS catches an
 * off-by-one-directory mistake — the bug that shipped in an earlier
 * per-platform version of this module, where only the filename was asserted
 * and the wrong depth went unnoticed.
 *
 * The macOS and Windows cases live on
 * sandy/feat/url-tracking-on-remaining-os alongside those resolvers.
 */
describe('resolver entry-point paths', () => {
  it('points linux at its sibling resolver directory', () => {
    const path = resolveLinuxResolverPath();
    expect(path.endsWith(join('resolvers', 'linux', 'index.js'))).toBe(true);
    // The directory it lives in must exist — proves the depth is right.
    expect(existsSync(join(path, '..'))).toBe(true);
  });
});
