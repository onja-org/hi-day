import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const safeStorage = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => false),
  encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
  decryptString: vi.fn((value: Buffer) => value.toString('utf-8')),
}));
vi.mock('electron', () => ({ safeStorage }));

import { AuthStore } from '../auth-store';

describe('AuthStore.load', () => {
  let userDataDir: string;

  beforeEach(() => {
    safeStorage.isEncryptionAvailable.mockReturnValue(false);
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-auth-store-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('reads back what it saved', () => {
    const store = new AuthStore(userDataDir);
    store.save({
      email: 'someone@example.com',
      organisationName: 'Acme',
      deviceId: 'device-1',
      deviceToken: 'token-1',
    });

    expect(store.load()?.deviceToken).toBe('token-1');
  });

  it('has no session before anything is saved', () => {
    expect(new AuthStore(userDataDir).load()).toBeNull();
  });

  /**
   * Every one of these used to throw rather than return null, rejecting
   * `auth:status` — and the renderer's boot path has no other way to leave
   * the first-run screen, so a throw here stranded someone on it with no
   * way into the app at all.
   */
  it('reports no session rather than throwing on unreadable content', () => {
    writeFileSync(join(userDataDir, 'session.dat'), 'not json at all', 'utf-8');

    expect(() => new AuthStore(userDataDir).load()).not.toThrow();
    expect(new AuthStore(userDataDir).load()).toBeNull();
  });

  it('reports no session rather than throwing when decryption fails', () => {
    writeFileSync(join(userDataDir, 'session.dat'), 'encrypted-elsewhere', 'utf-8');
    safeStorage.isEncryptionAvailable.mockReturnValue(true);
    safeStorage.decryptString.mockImplementation(() => {
      throw new Error('keyring no longer holds this key');
    });

    expect(() => new AuthStore(userDataDir).load()).not.toThrow();
    expect(new AuthStore(userDataDir).load()).toBeNull();
  });
});
