import { configDefaults, defineConfig } from 'vitest/config';

/**
 * The darwin resolver shells out to macOS-only binaries — `osascript`, the
 * Swift accessibility helper — and its tests stand those in with `.mjs`
 * scripts launched by shebang. Windows has no notion of a shebang, so
 * `spawn` answers EFTYPE and every one of them fails, on a platform where
 * none of that code ever runs.
 *
 * Excluded wholesale rather than skipped file by file. The first attempt
 * skipped only the files GitHub's ten-annotation cap happened to show, and
 * three more were waiting behind them; a directory rule also covers darwin
 * tests nobody has written yet.
 *
 * Linux and macOS still run all of it, macOS being where it actually
 * executes. Tests outside this directory that assert win32 paths —
 * `resolvers/tests/resolver-paths.spec.ts`, `tests/before-pack.spec.ts` —
 * deliberately stay in the Windows run, since that is the platform they
 * describe.
 */
const excludeOnWindows =
  process.platform === 'win32' ? ['src/main/resolvers/darwin/**'] : [];

export default defineConfig({
  test: {
    include: ['src/main/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, ...excludeOnWindows],
    environment: 'node',
  },
});
