import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveFirefoxAxHelperPath } from '../firefox-ax-helper-path';

// Expectations are built with `join`, not written as POSIX literals: the
// code under test uses `join` too, so on Windows it returns backslashes and
// a hardcoded "/a/b" can never match. These paths are platform-native by
// design — the assertion was the thing that was wrong, not the path.

describe('resolveFirefoxAxHelperPath', () => {
  it('resolves under resourcesPath/native/darwin when packaged', () => {
    const path = resolveFirefoxAxHelperPath({
      isPackaged: true,
      resourcesPath: '/Applications/App.app/Contents/Resources',
    });

    expect(path).toBe(
      join(
        '/Applications/App.app/Contents/Resources',
        'native',
        'darwin',
        'firefox-ax-helper',
      ),
    );
  });

  it('falls back to the dev path when not packaged, ignoring resourcesPath', () => {
    const path = resolveFirefoxAxHelperPath({ isPackaged: false, resourcesPath: '/should/not/appear' });

    // Separator-free so it still bites on Windows, where the path the code
    // builds would use backslashes.
    expect(path).not.toContain('should');
    expect(path.endsWith(join('native', 'darwin', 'firefox-ax-helper'))).toBe(true);
  });

  it('falls back to the dev path when packaged but resourcesPath is missing', () => {
    const path = resolveFirefoxAxHelperPath({ isPackaged: true, resourcesPath: undefined });

    expect(path.endsWith(join('native', 'darwin', 'firefox-ax-helper'))).toBe(true);
  });
});
