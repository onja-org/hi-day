import { describe, expect, it } from 'vitest';
import { isScreenLocked } from '../screen-lock';

const answers = (...values: (boolean | null | 'throws' | 'hangs')[]) =>
  values.map((value) => () => {
    if (value === 'throws') return Promise.reject(new Error('no such service'));
    if (value === 'hangs') return new Promise<boolean | null>(() => undefined);
    return Promise.resolve(value);
  });

describe('isScreenLocked', () => {
  it('is locked when logind says so, as GNOME, KDE and most desktops report it there', async () => {
    expect(await isScreenLocked(answers(true, false, 'throws'))).toBe(true);
  });

  it('is locked when only a desktop screensaver says so', async () => {
    // GNOME without a logind session (an app started outside it), or KDE's
    // org.freedesktop.ScreenSaver on a desktop that does not set LockedHint.
    expect(await isScreenLocked(answers('throws', true, 'throws'))).toBe(true);
    expect(await isScreenLocked(answers(false, 'throws', true))).toBe(true);
  });

  it('is unlocked when every source that answers says unlocked', async () => {
    expect(await isScreenLocked(answers(false, false, 'throws'))).toBe(false);
  });

  it('counts as unlocked when nothing can tell, so capture works as before', async () => {
    expect(await isScreenLocked(answers('throws', 'throws', null))).toBe(false);
  });

  it('does not wait on a source that never answers', async () => {
    const started = Date.now();

    expect(await isScreenLocked(answers('hangs', false, 'hangs'), 50)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
