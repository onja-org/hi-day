import { describe, expect, it } from 'vitest';
import { resolveWinResolverPath } from '../resolver-path';

describe('resolveWinResolverPath', () => {
  it('resolves under resourcesPath/native/win/resolver when packaged', () => {
    const path = resolveWinResolverPath({ isPackaged: true, resourcesPath: '/Applications/App.app/Contents/Resources' });

    expect(path).toBe('/Applications/App.app/Contents/Resources/native/win/resolver/win-resolver.exe');
  });

  it('ignores resourcesPath entirely when not packaged', () => {
    const path = resolveWinResolverPath({ isPackaged: false, resourcesPath: '/should/not/appear/anywhere' });

    expect(path).not.toContain('/should/not/appear/anywhere');
    expect(path.endsWith('win-resolver.exe')).toBe(true);
  });
});
