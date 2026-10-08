import { describe, expect, it } from 'vitest';
import { supportsSilentAutoUpdate, withoutStaleUpdate } from '../auto-updater';

describe('supportsSilentAutoUpdate', () => {
  it('is true on Windows and Linux', () => {
    expect(supportsSilentAutoUpdate('win32')).toBe(true);
    expect(supportsSilentAutoUpdate('linux')).toBe(true);
  });

  it('is false on macOS until the app is code-signed', () => {
    expect(supportsSilentAutoUpdate('darwin')).toBe(false);
  });
});

describe('withoutStaleUpdate', () => {
  it('hides a downloaded update for the version already running', () => {
    expect(
      withoutStaleUpdate({ phase: 'downloaded', latestVersion: '0.2.6' }, '0.2.6'),
    ).toEqual({ phase: 'idle' });
  });

  it('hides an in-flight download of an older version', () => {
    expect(
      withoutStaleUpdate(
        { phase: 'downloading', latestVersion: '0.2.4', progressPercent: 40 },
        '0.2.6',
      ),
    ).toEqual({ phase: 'idle' });
  });

  it('keeps a newer version', () => {
    const state = { phase: 'downloaded' as const, latestVersion: '0.2.7' };
    expect(withoutStaleUpdate(state, '0.2.6')).toBe(state);
  });

  it('keeps a download whose version is not known yet', () => {
    const state = { phase: 'downloading' as const, progressPercent: 10 };
    expect(withoutStaleUpdate(state, '0.2.6')).toBe(state);
  });
});
