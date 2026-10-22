import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BACKLOG_MESSAGE,
  BACKLOG_WARNING_AFTER_MS,
  shouldWarnAboutBacklog,
} from '../sync-backlog';

// The queue makes a dropped connection cost nothing, and therefore also
// lets one fail in silence: data piles up, the timer looks normal, and
// nothing says none of it has reached anybody.
describe('warning that tracked data has not been uploaded', () => {
  const MINUTE = 60 * 1000;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('when it stays quiet', () => {
    it('says nothing when everything has been sent, however long the outage', () => {
      // Working offline is the design, not a fault. Claiming data may be
      // unsynced when all of it is teaches people to ignore the banner.
      expect(
        shouldWarnAboutBacklog({ hasUnsent: false, silentForMs: 60 * MINUTE }),
      ).toBe(false);
    });

    it('says nothing about a queue while the server is still answering', () => {
      // Items wait their turn by design — they are drained on a timer, and
      // a batch mid-flight is not a backlog.
      expect(shouldWarnAboutBacklog({ hasUnsent: true, silentForMs: 0 })).toBe(
        false,
      );
    });

    it('rides out a short outage without alarming anybody', () => {
      expect(
        shouldWarnAboutBacklog({ hasUnsent: true, silentForMs: 2 * MINUTE }),
      ).toBe(false);
    });

    it('says nothing before the server has ever answered', () => {
      // Nothing to measure against, and inventing a duration would be a
      // guess. Unreachable in practice: pairing is itself a successful
      // request, so data cannot be waiting before one has happened.
      expect(
        shouldWarnAboutBacklog({ hasUnsent: true, silentForMs: null }),
      ).toBe(false);
    });
  });

  describe('when it speaks up', () => {
    it('warns once data has been waiting through a real outage', () => {
      expect(
        shouldWarnAboutBacklog({ hasUnsent: true, silentForMs: 6 * MINUTE }),
      ).toBe(true);
    });

    it('warns exactly at the threshold, not a tick after', () => {
      expect(
        shouldWarnAboutBacklog({
          hasUnsent: true,
          silentForMs: BACKLOG_WARNING_AFTER_MS,
        }),
      ).toBe(true);
    });

    it('takes a shorter window from the environment', async () => {
      // Read at import, so the module has to be loaded again to see it.
      vi.resetModules();
      vi.stubEnv('WM_BACKLOG_WARNING_MS', '10000');

      const module = await import('../sync-backlog');

      expect(module.BACKLOG_WARNING_AFTER_MS).toBe(10_000);
    });

    it('keeps the five-minute default when the environment says nothing', () => {
      expect(BACKLOG_WARNING_AFTER_MS).toBe(5 * 60 * 1000);
    });
  });

  // "Your data may not be synced" alone reads as "your hours are gone".
  describe('what it says', () => {
    it('promises the data is not lost', () => {
      expect(BACKLOG_MESSAGE).toMatch(/nothing is lost/i);
      expect(BACKLOG_MESSAGE).toMatch(/saved on this computer/i);
    });

    it('names both things the person can try', () => {
      expect(BACKLOG_MESSAGE).toMatch(/connection/i);
      expect(BACKLOG_MESSAGE).toMatch(/restart/i);
    });
  });
});

// Static markup, so the wording is pinned here rather than left to
// whoever next edits the file.
describe('the uploading-data dialog', () => {
  const html = readFileSync(
    join(__dirname, '..', '..', 'renderer', 'index.html'),
    'utf8',
  );
  // Whitespace collapsed: the markup wraps for readability, and these
  // assertions are about the words, not where the lines happen to break.
  const dialog = html
    .slice(
      html.indexOf('id="sync-backlog-dialog"'),
      html.indexOf('id="recovered-timer"'),
    )
    .replace(/\s+/g, ' ');

  it('says the data may not have reached the server', () => {
    expect(dialog).toMatch(/issues uploading the data/i);
    expect(dialog).toMatch(/may not have been fully synchronized/i);
  });

  it('names both things the person can try', () => {
    expect(dialog).toMatch(/internet connection/i);
    expect(dialog).toMatch(/restart/i);
  });

  it('is a dialog, announced as one', () => {
    // Not a banner: it takes focus and interrupts, so assistive
    // technology has to be told that rather than left to infer it.
    expect(dialog).toContain('role="alertdialog"');
    expect(dialog).toContain('aria-modal="true"');
  });
});

// Read while deciding whether to wait or go, so it is pinned too.
describe('the quit-time uploading dialog', () => {
  const html = readFileSync(
    join(__dirname, '..', '..', 'renderer', 'index.html'),
    'utf8',
  );
  const dialog = html
    .slice(
      html.indexOf('id="sync-draining"'),
      html.indexOf('id="sync-backlog-dialog"'),
    )
    .replace(/\s+/g, ' ');

  it('says what is happening and that it is not finished', () => {
    expect(dialog).toMatch(/Uploading data/i);
    expect(dialog).toMatch(/has not been sent to the server/i);
    expect(dialog).toMatch(/wait until completed/i);
  });

  /**
   * Stopping the timer is a network call, so even a quit with an empty
   * queue leaves the window up for a moment. Saying "there is data that
   * has not been sent" then would be a plain lie, so the dialog carries
   * a second, truthful face for it.
   */
  it('has a second wording for a quit with nothing to upload', () => {
    expect(dialog).toContain('id="sync-draining-title-closing"');
    expect(dialog).toContain('id="sync-draining-saving"');
    expect(dialog).toMatch(/Closing Hi Day/i);
    expect(dialog).toMatch(/Saving your tracked time/i);
  });

  it('shows how long it will wait, counting down', () => {
    // Driven by its own ticker in main rather than by the upload loop:
    // an attempt against an unreachable server takes the whole budget to
    // fail, so a countdown tied to the loop would sit on 5 and vanish.
    expect(dialog).toContain('id="sync-draining-countdown"');
  });

  it('leaves the countdown unannounced, unlike the record count', () => {
    // A number repeating every second would talk over the part that
    // matters. The count keeps aria-live; the clock does not.
    const countdown = dialog.slice(dialog.indexOf('id="sync-draining-countdown"'));
    expect(countdown.slice(0, countdown.indexOf('>'))).not.toContain('aria-live');
  });

  it('has somewhere to put the count', () => {
    // A number falling towards zero is what lets somebody judge whether
    // waiting is worth it; a spinner says "wait" without saying how long.
    expect(dialog).toContain('id="sync-draining-count"');
  });

  it('announces the count as it changes', () => {
    // It updates while focus sits on the Close button, so a screen
    // reader has to be told the number moved.
    expect(dialog).toContain('aria-live="polite"');
  });

  it('always offers a way out', () => {
    // Quitting mid-upload is explicitly safe: the data is on disk and
    // goes up next launch. Trapping somebody would buy nothing.
    expect(dialog).toContain('id="sync-draining-close"');
    expect(dialog).toMatch(/>\s*Close\s*</i);
  });
});
