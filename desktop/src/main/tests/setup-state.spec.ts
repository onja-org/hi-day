import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasSeenBrowserRestartPrompt,
  markBrowserRestartPromptSeen,
  rememberCloseAction,
  rememberedCloseAction,
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

describe('what the record survives', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-setup-state-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  /**
   * The screen is asked once, after the app is installed, and never again.
   * Nothing clears the record any more — an update rewrites the launcher
   * files and used to hand the question back, which meant a second prompt
   * months later for a question already answered. The record lives beside
   * the session rather than in the package, so an update installed over the
   * top leaves it where it is.
   */
  it('cannot be un-answered once it has been answered', () => {
    markBrowserRestartPromptSeen(userDataDir);

    // Whatever else happens to the install — a rewritten launcher, a new
    // version, a re-pairing — the only thing that reads this still says yes.
    expect(hasSeenBrowserRestartPrompt(userDataDir)).toBe(true);
  });

  /**
   * Read as text because the guarantee is the absence of a call, which no
   * amount of exercising the module can demonstrate. An update rewrites the
   * launcher files, and clearing on that is what handed the question back.
   */
  it('has nothing anywhere that clears it', () => {
    const main = readFileSync(join(__dirname, '../main.ts'), 'utf-8');
    const store = readFileSync(join(__dirname, '../setup-state.ts'), 'utf-8');

    expect(main).not.toContain('clearBrowserRestartPromptSeen');
    expect(store).not.toContain('clearBrowserRestartPromptSeen');
  });
});

describe('remembered close action', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-close-action-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('asks on a fresh install', () => {
    expect(rememberedCloseAction(userDataDir)).toBeNull();
  });

  it('remembers the chosen action', () => {
    rememberCloseAction(userDataDir, 'quit');

    expect(rememberedCloseAction(userDataDir)).toBe('quit');
  });

  it('goes back to asking when cleared', () => {
    rememberCloseAction(userDataDir, 'minimize');
    rememberCloseAction(userDataDir, null);

    expect(rememberedCloseAction(userDataDir)).toBeNull();
  });

  // Both live in one file, so neither write may drop the other.
  it('keeps the browser-restart flag alongside it', () => {
    markBrowserRestartPromptSeen(userDataDir);
    rememberCloseAction(userDataDir, 'minimize');
    rememberCloseAction(userDataDir, null);

    expect(hasSeenBrowserRestartPrompt(userDataDir)).toBe(true);
  });

  it('asks rather than quitting silently on an unrecognised value', () => {
    writeFileSync(join(userDataDir, 'setup-state.json'), JSON.stringify({ closeAction: 'explode' }));

    expect(rememberedCloseAction(userDataDir)).toBeNull();
  });
});
