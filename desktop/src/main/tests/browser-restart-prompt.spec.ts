import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  browserRestartPrompt,
  type BlindBrowserReportLike,
} from '../browser-restart-prompt';
import { markBrowserRestartPromptSeen } from '../setup-state';

/** One blind Chrome, the ordinary case that makes the screen appear. */
function oneOpenBrowser(): BlindBrowserReportLike {
  return {
    restartable: [{ command: 'chrome' }],
    manual: [],
    warnings: [],
  };
}

describe('browserRestartPrompt', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-restart-prompt-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  function ask(overrides: Partial<Parameters<typeof browserRestartPrompt>[0]> = {}) {
    return browserRestartPrompt({
      platform: 'linux',
      userDataDir,
      findBrowsers: oneOpenBrowser,
      ...overrides,
    });
  }

  it('asks when a blind browser is running on a fresh Linux install', () => {
    const prompt = ask();

    expect(prompt.show).toBe(true);
    expect(prompt.names).toEqual(['Chrome']);
  });

  // Linux only: the launcher override this compensates for exists nowhere
  // else, so no other platform may ever see this screen.
  it.each(['darwin', 'win32'])('never asks on %s', (platform) => {
    const findBrowsers = vi.fn(oneOpenBrowser);

    const prompt = browserRestartPrompt({ platform, userDataDir, findBrowsers });

    expect(prompt.show).toBe(false);
    // Not even scanned: the answer cannot depend on what is running.
    expect(findBrowsers).not.toHaveBeenCalled();
  });

  /**
   * Nobody may skip past this by quitting. Only pressing Continue records
   * an answer, so merely being shown the screen — or closing the window on
   * it — leaves it waiting at the next launch.
   */
  it('is not consumed by being shown, only by being answered', () => {
    expect(ask().show).toBe(true);
    expect(ask().show).toBe(true);
    expect(ask().show).toBe(true);
  });

  /**
   * The once-per-install promise. Everything else about the machine is
   * unchanged — the same blind browser is still running — and the answer is
   * still no.
   */
  it('never asks twice on the same install', () => {
    expect(ask().show).toBe(true);

    markBrowserRestartPromptSeen(userDataDir);

    expect(ask().show).toBe(false);
  });

  /**
   * The one showing is spent on a launch that has something to say, rather
   * than burned on a first launch with every browser closed.
   */
  it('stays unspent when no browser is blind', () => {
    const prompt = ask({
      findBrowsers: () => ({ restartable: [], manual: [], warnings: [] }),
    });

    expect(prompt.show).toBe(false);
    // Still unanswered, so a later launch with a blind browser gets it.
    expect(ask().show).toBe(true);
  });

  /**
   * The screen must only promise what pressing Continue actually does.
   * A browser with no launcher to start it from is reported separately,
   * never folded in with the ones that will be restarted.
   */
  it('keeps a browser it cannot restart out of the restart list', () => {
    const prompt = ask({
      findBrowsers: () => ({
        restartable: [{ command: 'chrome' }],
        manual: [
          { browser: { command: 'firefox' }, reason: 'Restart Firefox yourself.' },
        ],
        warnings: [],
      }),
    });

    expect(prompt.show).toBe(true);
    expect(prompt.names).toEqual(['Chrome']);
    expect(prompt.manual).toEqual([
      { name: 'Firefox', reason: 'Restart Firefox yourself.' },
    ]);
  });

  // Nothing restartable at all still has to be said — the person has to do
  // every one of them by hand.
  it('still asks when every blind browser must be restarted by hand', () => {
    const prompt = ask({
      findBrowsers: () => ({
        restartable: [],
        manual: [
          { browser: { command: 'firefox' }, reason: 'Restart Firefox yourself.' },
        ],
        warnings: [],
      }),
    });

    expect(prompt.show).toBe(true);
    expect(prompt.names).toEqual([]);
    expect(prompt.manual.map((e) => e.name)).toEqual(['Firefox']);
  });

  // findBrowsers reports one entry per process, so two windows of the same
  // browser must not produce the same sentence twice.
  it('names a browser once however many of its processes are blind', () => {
    const prompt = ask({
      findBrowsers: () => ({
        restartable: [{ command: 'chrome' }, { command: 'chrome' }],
        manual: [
          { browser: { command: 'firefox' }, reason: 'No launcher.' },
          { browser: { command: 'firefox' }, reason: 'No launcher.' },
        ],
        warnings: ['Same warning.', 'Same warning.'],
      }),
    });

    expect(prompt.names).toEqual(['Chrome']);
    expect(prompt.manual).toHaveLength(1);
    expect(prompt.warnings).toEqual(['Same warning.']);
  });

  // Runs before the first window is drawn, so a failed scan must degrade to
  // "nothing to ask" rather than take the app down with it.
  it('asks nothing when the scan throws', () => {
    const prompt = ask({
      findBrowsers: () => {
        throw new Error('/proc unreadable');
      },
    });

    expect(prompt.show).toBe(false);
  });
});
