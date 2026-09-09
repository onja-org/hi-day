import { describe, expect, it } from 'vitest';
import { resolveFirefoxAxHelperPath } from '../firefox-ax-helper-path';

describe('resolveFirefoxAxHelperPath', () => {
  it('resolves under resourcesPath/native/darwin when packaged', () => {
    const path = resolveFirefoxAxHelperPath({
      isPackaged: true,
      resourcesPath: '/Applications/App.app/Contents/Resources',
    });

    expect(path).toBe('/Applications/App.app/Contents/Resources/native/darwin/firefox-ax-helper');
  });

  it('falls back to the dev path when not packaged, ignoring resourcesPath', () => {
    const path = resolveFirefoxAxHelperPath({ isPackaged: false, resourcesPath: '/should/not/appear' });

    expect(path).not.toContain('/should/not/appear');
    expect(path.endsWith('native/darwin/firefox-ax-helper')).toBe(true);
  });

  it('falls back to the dev path when packaged but resourcesPath is missing', () => {
    const path = resolveFirefoxAxHelperPath({ isPackaged: true, resourcesPath: undefined });

    expect(path.endsWith('native/darwin/firefox-ax-helper')).toBe(true);
  });
});
