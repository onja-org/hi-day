import { describe, expect, it } from 'vitest';
import { isNewerVersion, parseVersionFromTag } from '../update-checker';

describe('parseVersionFromTag', () => {
  it('extracts the version from a desktop-v tag', () => {
    expect(parseVersionFromTag('desktop-v0.1.2')).toBe('0.1.2');
  });

  it('returns null for a tag in the wrong shape', () => {
    expect(parseVersionFromTag('v0.1.2')).toBeNull();
    expect(parseVersionFromTag('desktop-v0.1')).toBeNull();
    expect(parseVersionFromTag('not-a-tag')).toBeNull();
  });
});

describe('isNewerVersion', () => {
  it('is true when the latest major/minor/patch is higher', () => {
    expect(isNewerVersion('0.1.2', '0.1.3')).toBe(true);
    expect(isNewerVersion('0.1.2', '0.2.0')).toBe(true);
    expect(isNewerVersion('0.1.2', '1.0.0')).toBe(true);
  });

  it('is false when the latest is the same or older', () => {
    expect(isNewerVersion('0.1.2', '0.1.2')).toBe(false);
    expect(isNewerVersion('0.1.2', '0.1.1')).toBe(false);
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(false);
  });

  it('compares parts numerically, not lexicographically', () => {
    // "0.1.9" > "0.1.10" as strings, but not as versions.
    expect(isNewerVersion('0.1.9', '0.1.10')).toBe(true);
  });
});
