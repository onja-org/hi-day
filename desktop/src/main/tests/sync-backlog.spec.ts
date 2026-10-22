import { describe, expect, it } from 'vitest';
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
