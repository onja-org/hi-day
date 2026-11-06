import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  rememberedServerUrl,
  rememberServerUrl,
  rememberCloseAction,
  rememberedCloseAction,
} from '../setup-state';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hiday-setup-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Kept out of the session, which signing out deletes — the address is what
 * you need in order to sign back in. */
describe('remembering which server this install talks to', () => {
  it('is nothing until somebody sets one', () => {
    expect(rememberedServerUrl(dir)).toBeNull();
  });

  it('reads back what was stored', () => {
    rememberServerUrl(dir, 'https://hiday.acme.example');

    expect(rememberedServerUrl(dir)).toBe('https://hiday.acme.example');
  });

  it('replaces a previous answer rather than stacking', () => {
    rememberServerUrl(dir, 'https://first.example');
    rememberServerUrl(dir, 'https://second.example');

    expect(rememberedServerUrl(dir)).toBe('https://second.example');
  });

  // Clearing hands control back to the built-in default.
  it('can be cleared', () => {
    rememberServerUrl(dir, 'https://hiday.acme.example');
    rememberServerUrl(dir, null);

    expect(rememberedServerUrl(dir)).toBeNull();
  });

  /** Shares a file with the other remembered answers. */
  it('leaves the other remembered answers alone', () => {
    rememberCloseAction(dir, 'quit');

    rememberServerUrl(dir, 'https://hiday.acme.example');

    expect(rememberedCloseAction(dir)).toBe('quit');
    expect(rememberedServerUrl(dir)).toBe('https://hiday.acme.example');
  });

  it('still leaves them alone when cleared', () => {
    rememberCloseAction(dir, 'quit');
    rememberServerUrl(dir, 'https://hiday.acme.example');

    rememberServerUrl(dir, null);

    expect(rememberedCloseAction(dir)).toBe('quit');
  });

  /** A corrupt file must not throw on startup. */
  it('reads a corrupt file as nothing remembered', () => {
    writeFileSync(join(dir, 'setup-state.json'), '{not json');

    expect(rememberedServerUrl(dir)).toBeNull();
  });
});
