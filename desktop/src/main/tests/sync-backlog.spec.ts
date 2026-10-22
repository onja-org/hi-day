import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BACKLOG_MESSAGE,
  BACKLOG_WARNING_AFTER_MS,
  shouldWarnAboutBacklog,
} from '../sync-backlog';

/**
 * The gap this closes: the offline queue is what makes a dropped
 * connection cost nothing, and therefore also what lets it fail in
 * silence. Data piles up on disk, the timer looks completely normal, and
 * nothing says that none of it has reached anybody.
 */
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

    it('takes a shorter threshold when one is given', () => {
      expect(
        shouldWarnAboutBacklog(
          { hasUnsent: true, silentForMs: 30 * 1000 },
          10 * 1000,
        ),
      ).toBe(true);
    });
  });

  /**
   * The wording carries as much weight as the rule. "Your data may not be
   * synced" on its own reads as "your hours are gone", and somebody who
   * believes that starts keeping their time somewhere else.
   */
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

/**
 * The dialog is static markup, so what it says is pinned here rather than
 * left to whoever next edits the file. It interrupts the person, which
 * buys it the right to be read — and obliges it to say something worth
 * reading.
 */
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

  it('exists, with somewhere to read it and a way out', () => {
    expect(dialog).toContain('id="sync-backlog-title"');
    expect(dialog).toContain('id="sync-backlog-body"');
    expect(dialog).toContain('id="sync-backlog-close"');
  });

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
