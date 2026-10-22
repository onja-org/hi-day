import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CRASH_RECOVERY_FLOOR_MS,
  CRASH_RECOVERY_WINDOW_MS,
  keepActionFor,
  recoveryActionFor,
} from '../recovered-timer';

describe('what to do with a timer recovered at startup', () => {
  const MINUTE = 60 * 1000;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('keeps a gap too small to be worth a decision', () => {
    // The reported case: asked about one minute, after they relaunched
    // the app themselves.
    expect(recoveryActionFor(1 * MINUTE)).toBe('keep');
    expect(recoveryActionFor(CRASH_RECOVERY_FLOOR_MS - 1)).toBe('keep');
  });

  it('keeps it when the clock has moved backwards', () => {
    // A negative gap cannot be trusted; keeping neither ends nor queries
    // an entry on the strength of it.
    expect(recoveryActionFor(-5 * MINUTE)).toBe('keep');
  });

  it('asks across the band only the person can account for', () => {
    expect(recoveryActionFor(CRASH_RECOVERY_FLOOR_MS)).toBe('ask');
    expect(recoveryActionFor(CRASH_RECOVERY_WINDOW_MS)).toBe('ask');
  });

  it('ends an entry past the ceiling rather than asking', () => {
    expect(recoveryActionFor(CRASH_RECOVERY_WINDOW_MS + 1)).toBe('end');
  });

  it('never keeps an ancient gap, even with the thresholds inverted', () => {
    // Ceiling first, so a misconfigured floor above it cannot produce a
    // band where any gap at all is silently kept.
    expect(recoveryActionFor(10 * 60 * MINUTE, 20 * 60 * MINUTE, MINUTE)).toBe(
      'end',
    );
  });

  it('defaults to two minutes and one hour', () => {
    expect(CRASH_RECOVERY_FLOOR_MS).toBe(2 * MINUTE);
    expect(CRASH_RECOVERY_WINDOW_MS).toBe(60 * MINUTE);
  });

  it('takes both bands from the environment', () => {
    // Otherwise the prompt needs a crash and a wait of between two and
    // sixty minutes to reach at all.
    vi.resetModules();
    vi.stubEnv('WM_CRASH_RECOVERY_FLOOR_MS', '1000');
    vi.stubEnv('WM_CRASH_RECOVERY_WINDOW_MS', '5000');

    return import('../recovered-timer').then((module) => {
      expect(module.CRASH_RECOVERY_FLOOR_MS).toBe(1000);
      expect(module.CRASH_RECOVERY_WINDOW_MS).toBe(5000);
      expect(module.recoveryActionFor(2000)).toBe('ask');
    });
  });
});

/**
 * Past the backend's half-hour grace the sweeper has already closed the
 * entry, so "keep" used to do nothing: the next poll reported no timer,
 * the clock stopped, and the answer was discarded with the time it was
 * meant to claim.
 */
describe('carrying on after keeping a recovered timer', () => {
  it('does nothing when the entry is still open', () => {
    expect(keepActionFor({ answered: true, running: true })).toBe('carry-on');
  });

  it('reclaims the stretch when the server has already closed it', () => {
    expect(keepActionFor({ answered: true, running: false })).toBe('reopen');
  });

  it('does nothing when the server cannot be reached', () => {
    // The local entry stays open, and whenever they stop, that stop
    // extends the closed entry to the real time.
    expect(keepActionFor({ answered: false, running: false })).toBe('carry-on');
    // `running` must not decide without an answer, or an unreachable
    // server would reopen on a stale belief.
    expect(keepActionFor({ answered: false, running: true })).toBe('carry-on');
  });
});
