import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CRASH_RECOVERY_FLOOR_MS,
  CRASH_RECOVERY_WINDOW_MS,
  keepActionFor,
  recoveryActionFor,
} from '../recovered-timer';

/**
 * A timer still running when the app starts means it did not shut down —
 * every ordinary quit, sleep and shutdown stops it first — so this is a
 * crash, a power cut or a force-kill, and the stretch since is time
 * nobody observed.
 */
describe('what to do with a timer recovered at startup', () => {
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('a gap too small to be worth a decision', () => {
    it('keeps a timer the app came straight back to', () => {
      // They relaunched at once, which is evidence they were there.
      expect(recoveryActionFor(5 * SECOND)).toBe('keep');
    });

    it('keeps it at the reported one-minute gap that prompted this floor', () => {
      expect(recoveryActionFor(1 * MINUTE)).toBe('keep');
    });

    it('keeps it a tick below the floor', () => {
      expect(recoveryActionFor(CRASH_RECOVERY_FLOOR_MS - 1)).toBe('keep');
    });

    it('keeps it when no time has passed at all', () => {
      expect(recoveryActionFor(0)).toBe('keep');
    });

    it('keeps it when the clock has moved backwards', () => {
      // A negative gap is a number that cannot be trusted; keeping the
      // timer is the one answer that neither ends nor queries an entry on
      // the strength of it.
      expect(recoveryActionFor(-5 * MINUTE)).toBe('keep');
    });
  });

  describe('a gap only the person can account for', () => {
    it('asks exactly at the floor', () => {
      expect(recoveryActionFor(CRASH_RECOVERY_FLOOR_MS)).toBe('ask');
    });

    it('asks in the middle of the band', () => {
      expect(recoveryActionFor(20 * MINUTE)).toBe('ask');
    });

    it('asks right up to the ceiling', () => {
      expect(recoveryActionFor(CRASH_RECOVERY_WINDOW_MS)).toBe('ask');
    });
  });

  describe('a gap too long to ask about', () => {
    it('ends the entry a tick past the ceiling', () => {
      expect(recoveryActionFor(CRASH_RECOVERY_WINDOW_MS + 1)).toBe('end');
    });

    it('ends it after a machine left off overnight', () => {
      expect(recoveryActionFor(14 * 60 * MINUTE)).toBe('end');
    });
  });

  describe('the bands themselves', () => {
    it('leaves room between the floor and the ceiling', () => {
      expect(CRASH_RECOVERY_FLOOR_MS).toBeLessThan(CRASH_RECOVERY_WINDOW_MS);
    });

    it('defaults to two minutes and one hour', () => {
      expect(CRASH_RECOVERY_FLOOR_MS).toBe(2 * MINUTE);
      expect(CRASH_RECOVERY_WINDOW_MS).toBe(60 * MINUTE);
    });

    it('takes both from the environment, so the prompt can be reached on demand', async () => {
      vi.resetModules();
      vi.stubEnv('WM_CRASH_RECOVERY_FLOOR_MS', '1000');
      vi.stubEnv('WM_CRASH_RECOVERY_WINDOW_MS', '5000');

      const module = await import('../recovered-timer');

      expect(module.CRASH_RECOVERY_FLOOR_MS).toBe(1000);
      expect(module.CRASH_RECOVERY_WINDOW_MS).toBe(5000);
      // Without the override the prompt needs a crash and a wait of
      // between two and sixty minutes to reach at all.
      expect(module.recoveryActionFor(2000)).toBe('ask');
    });

    it('honours thresholds passed in directly', () => {
      expect(recoveryActionFor(30 * SECOND, 10 * SECOND, MINUTE)).toBe('ask');
    });

    /**
     * A misconfigured override could put the floor above the ceiling.
     * Checking the ceiling first means the worst case is "asks nothing
     * and ends it", never "silently keeps a gap of any size".
     */
    it('never keeps an ancient gap, even with the thresholds inverted', () => {
      expect(recoveryActionFor(10 * 60 * MINUTE, 20 * 60 * MINUTE, MINUTE)).toBe(
        'end',
      );
    });
  });
});

/**
 * Answering "yes, I was still working" used to do nothing at all, which
 * was fine right up until the backend's half-hour grace had already
 * closed the entry being asked about — the next poll reported no timer,
 * the clock stopped, and the answer was discarded along with the time it
 * was meant to claim.
 */
describe('carrying on after keeping a recovered timer', () => {
  it('does nothing when the entry is still open', () => {
    expect(keepActionFor({ answered: true, running: true })).toBe('carry-on');
  });

  it('reclaims the stretch when the server has already closed it', () => {
    // The sweeper got there first. Without this the person said "I was
    // working" and watched the clock stop anyway.
    expect(keepActionFor({ answered: true, running: false })).toBe('reopen');
  });

  it('does nothing when the server cannot be reached', () => {
    // Offline the local entry stays open, and whenever they do stop,
    // that stop extends the closed entry to the real time. Reopening
    // blind would cut the day in two for nothing.
    expect(keepActionFor({ answered: false, running: false })).toBe('carry-on');
  });

  it('trusts the answer over the guess when both are present', () => {
    // `running` is meaningless without an answer; it must not be what
    // decides, or an unreachable server would reopen on a stale belief.
    expect(keepActionFor({ answered: false, running: true })).toBe('carry-on');
  });
});
