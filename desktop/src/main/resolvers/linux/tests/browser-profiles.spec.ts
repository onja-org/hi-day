import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readOpenProfiles } from '../browser-profiles';

/** A /proc/<pid>/fd directory holding the paths a browser has open. */
function procWithOpenFiles(paths: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'proc-'));
  const descriptors = join(root, '42', 'fd');
  mkdirSync(descriptors, { recursive: true });
  paths.forEach((path, index) => {
    const target = join(root, 'files', path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, '');
    symlinkSync(target, join(descriptors, String(index)));
  });
  return root;
}

describe('readOpenProfiles', () => {
  it('names every profile the browser has open, and where they live', () => {
    const root = procWithOpenFiles([
      'home/.config/google-chrome/Default/History',
      'home/.config/google-chrome/Profile 3/Cookies',
      'home/.config/google-chrome/Profile 3/History',
    ]);

    const open = readOpenProfiles(42, root);

    expect(open.profiles).toEqual(['Default', 'Profile 3']);
    expect(open.userDataDir).toBe(join(root, 'files/home/.config/google-chrome'));
  });

  /** Chromium's own, with no window on screen — reopening either invents one. */
  it('ignores the system and guest profiles', () => {
    const root = procWithOpenFiles([
      'home/.config/google-chrome/System Profile/Network',
      'home/.config/google-chrome/Guest Profile/History',
    ]);

    expect(readOpenProfiles(42, root).profiles).toEqual([]);
  });

  it('answers empty for a process it cannot read', () => {
    expect(readOpenProfiles(999999, '/nonexistent')).toEqual({
      userDataDir: null,
      profiles: [],
    });
  });
});
