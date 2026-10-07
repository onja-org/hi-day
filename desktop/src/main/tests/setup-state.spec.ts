import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearBrowserRestartPromptSeen,
  hasSeenBrowserRestartPrompt,
  markBrowserRestartPromptSeen,
} from '../setup-state';

describe('setup state', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-setup-state-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('has seen nothing on a fresh install', () => {
    expect(hasSeenBrowserRestartPrompt(userDataDir)).toBe(false);
  });

  it('remembers the prompt once it has been answered', () => {
    markBrowserRestartPromptSeen(userDataDir);

    expect(hasSeenBrowserRestartPrompt(userDataDir)).toBe(true);
  });

  // The screen is a once-ever promise, so the flag has to survive every
  // later write rather than being overwritten by one.
  it('stays seen when marked again', () => {
    markBrowserRestartPromptSeen(userDataDir);
    markBrowserRestartPromptSeen(userDataDir);

    expect(hasSeenBrowserRestartPrompt(userDataDir)).toBe(true);
  });

  it('creates the directory when it does not exist yet', () => {
    const nested = join(userDataDir, 'does', 'not', 'exist');

    markBrowserRestartPromptSeen(nested);

    expect(hasSeenBrowserRestartPrompt(nested)).toBe(true);
  });

  /**
   * Reading must never throw: this runs before the first window is shown,
   * so an exception here would leave the app with no UI at all. Showing a
   * one-time screen twice is the cheaper failure.
   */
  it('treats an unreadable file as nothing done yet', () => {
    writeFileSync(join(userDataDir, 'setup-state.json'), '{ not json', 'utf-8');

    expect(hasSeenBrowserRestartPrompt(userDataDir)).toBe(false);
  });
});

describe('clearBrowserRestartPromptSeen', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-setup-state-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  // The record survives logout, re-pairing and an update installed over the
  // top — all things that leave the launcher overrides in place. Only a
  // genuine reinstall removes those, and that is the one case where the
  // browsers open right now have been orphaned from their launchers without
  // ever being offered the restart that reseats them.
  it('gives the screen another turn after a reinstall', () => {
    markBrowserRestartPromptSeen(userDataDir);
    expect(hasSeenBrowserRestartPrompt(userDataDir)).toBe(true);

    clearBrowserRestartPromptSeen(userDataDir);

    expect(hasSeenBrowserRestartPrompt(userDataDir)).toBe(false);
  });

  it('is harmless when nothing was recorded yet', () => {
    expect(() => clearBrowserRestartPromptSeen(userDataDir)).not.toThrow();
    expect(hasSeenBrowserRestartPrompt(userDataDir)).toBe(false);
  });
});
