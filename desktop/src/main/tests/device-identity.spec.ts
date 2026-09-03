import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getOrCreateDeviceFingerprint } from '../device-identity';

describe('getOrCreateDeviceFingerprint', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-device-identity-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('creates a fingerprint on first call', () => {
    const fingerprint = getOrCreateDeviceFingerprint(userDataDir);
    expect(fingerprint).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('returns the same fingerprint on subsequent calls', () => {
    const first = getOrCreateDeviceFingerprint(userDataDir);
    const second = getOrCreateDeviceFingerprint(userDataDir);
    expect(second).toBe(first);
  });

  it('creates the user data directory if it does not exist yet', () => {
    const nestedDir = join(userDataDir, 'nested');
    expect(() => getOrCreateDeviceFingerprint(nestedDir)).not.toThrow();
  });
});
