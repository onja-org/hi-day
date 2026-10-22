import { describe, expect, it, vi } from 'vitest';
import {
  browserRestartPrompt,
  browsersOrphanedBySweep,
  type BlindBrowserReportLike,
} from '../browser-restart-prompt';

/** One blind Chrome, the ordinary case that makes the screen appear. */
function oneOpenBrowser(): BlindBrowserReportLike {
  return {
    restartable: [{ command: 'chrome' }],
    manual: [],
    warnings: [],
  };
}

describe('browserRestartPrompt', () => {
  function ask(overrides: Partial<Parameters<typeof browserRestartPrompt>[0]> = {}) {
    return browserRestartPrompt({
      platform: 'linux',
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

    const prompt = browserRestartPrompt({ platform, findBrowsers });

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
   * Asked per orphaning, not once per install. A second sweep that writes a
   * launcher orphans the windows open at *that* moment just as the first
   * did, so it has to be able to ask again — remembering an answer across
   * installs is what left a later sweep's orphans with no screen at all.
   *
   * What stops it nagging is the caller: `browsersOrphanedBySweep` hands
   * back an empty set on any launch that wrote nothing.
   */
  it('asks again when a later sweep orphans windows afresh', () => {
    expect(ask().show).toBe(true);
    expect(ask().show).toBe(true);
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

describe('browsersOrphanedBySweep', () => {
  const open = {
    restartable: [{ command: 'firefox' }],
    manual: [{ browser: { command: 'brave' }, reason: 'Restart Brave yourself.' }],
    warnings: ['Firefox will not reopen its tabs.'],
  };

  it('hands back the open browsers when the sweep created an override', () => {
    expect(browsersOrphanedBySweep(open, [{ created: true }])).toEqual(open);
  });

  // The guarantee the screen rests on: a sweep that creates nothing disturbs
  // nothing, so every launch after the first has no one to ask about. Without
  // this the screen returns on every launch until someone answers it — and
  // with the predicate now "open" rather than "blind", it would return even
  // for browsers restarted in the meantime that are perfectly fine.
  it('hands back nothing when the sweep created no override', () => {
    expect(browsersOrphanedBySweep(open, [{}, { created: false }])).toEqual({
      restartable: [],
      manual: [],
      warnings: [],
    });
  });

  /**
   * What renaming the app did: every override already existed, so none was
   * created, but all were replaced — and the browsers open at the time lost
   * their launcher binding (no running indicator, and the icon opening a new
   * window) with nothing offering to reseat them.
   */
  it('hands back the open browsers when the sweep rewrote an override', () => {
    expect(
      browsersOrphanedBySweep(open, [{ activated: true, created: false }]),
    ).toEqual(open);
  });

  // The guarantee that holds the screen to one appearance: an ordinary
  // launch leaves every entry alone and so disturbs nobody.
  it('hands back nothing when every entry was left untouched', () => {
    expect(
      browsersOrphanedBySweep(open, [
        { activated: true, unchanged: true },
        { activated: true, unchanged: true },
      ]),
    ).toEqual({ restartable: [], manual: [], warnings: [] });
  });

  // A write that failed orphaned nothing, because nothing was replaced.
  it('hands back nothing when the sweep could not write at all', () => {
    expect(
      browsersOrphanedBySweep(open, [{ activated: false }]).restartable,
    ).toEqual([]);
  });

  it('hands back nothing when the sweep touched no entry at all', () => {
    expect(browsersOrphanedBySweep(open, []).restartable).toEqual([]);
  });

  it('leaves the screen with nothing to show, end to end', () => {
    const prompt = browserRestartPrompt({
      platform: 'linux',
      findBrowsers: () => browsersOrphanedBySweep(open, [{ created: false }]),
    });

    expect(prompt.show).toBe(false);
  });
});
