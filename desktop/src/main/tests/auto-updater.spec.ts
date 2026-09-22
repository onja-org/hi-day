import { describe, expect, it } from 'vitest';
import { supportsSilentAutoUpdate } from '../auto-updater';

describe('supportsSilentAutoUpdate', () => {
  it('is true on Windows and Linux', () => {
    expect(supportsSilentAutoUpdate('win32')).toBe(true);
    expect(supportsSilentAutoUpdate('linux')).toBe(true);
  });

  it('is false on macOS until the app is code-signed', () => {
    expect(supportsSilentAutoUpdate('darwin')).toBe(false);
  });
});
