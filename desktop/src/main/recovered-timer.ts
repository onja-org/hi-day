import { intervalFromEnv } from './tuning';

/**
 * Below this, a timer found still running at startup is simply kept.
 *
 * The prompt exists because the app cannot know whether somebody kept
 * working through a gap it was not there to observe. Under a couple of
 * minutes there is nothing genuinely in doubt: they relaunched the app,
 * which is evidence they were at the machine, and the most that could be
 * wrong either way is a minute or two.
 *
 * Asking anyway spends an interruption and a decision on noise — and a
 * prompt that fires for trivia is one people learn to click through
 * without reading, which costs us the cases that actually matter. The
 * alternative, ending the entry at the last sign of life, is defensible
 * but accumulates: a flaky machine crashing six times a day would dock
 * somebody ten minutes they worked, silently.
 *
 * Hubstaff documents no floor at all, only the hour above — this one is
 * ours, which is also why it is tunable.
 */
export const CRASH_RECOVERY_FLOOR_MS = intervalFromEnv(
  'WM_CRASH_RECOVERY_FLOOR_MS',
  2 * 60 * 1000,
);

/**
 * Above this, the gap is too long to be plausibly "it crashed and I
 * restarted it", so the entry is ended where the app was last known to be
 * running and nothing is claimed for the silence. Matches Hubstaff's own
 * published one-hour rule rather than a number invented here.
 */
export const CRASH_RECOVERY_WINDOW_MS = intervalFromEnv(
  'WM_CRASH_RECOVERY_WINDOW_MS',
  60 * 60 * 1000,
);

/**
 * - `keep`: leave the timer running and say nothing.
 * - `ask`: only the person knows whether they worked through the gap.
 * - `end`: close the entry where the app was last seen alive.
 */
export type RecoveryAction = 'keep' | 'ask' | 'end';

/**
 * What to do with a timer found still running when the app started —
 * which only happens after a crash, a power cut or a force-kill, since
 * every ordinary quit, sleep and shutdown stops the timer first.
 *
 * `silentForMs` is how long since the app was last known to be alive with
 * that timer running. It is a *liveness* stamp, not a last-contact one:
 * measuring it from the server's last answer would have an outage read as
 * a crash, so an hour worked offline would be ended at the moment the
 * connection dropped and the rest of it thrown away.
 *
 * The ceiling is checked first, so a misconfigured floor above it cannot
 * produce a band where an ancient gap is silently kept.
 */
export function recoveryActionFor(
  silentForMs: number,
  floorMs: number = CRASH_RECOVERY_FLOOR_MS,
  ceilingMs: number = CRASH_RECOVERY_WINDOW_MS,
): RecoveryAction {
  if (silentForMs > ceilingMs) return 'end';
  // A clock moved backwards reads as no gap at all, which is the safe
  // reading: it keeps the timer rather than ending or querying an entry
  // on the strength of a number that cannot be trusted.
  if (silentForMs < floorMs) return 'keep';
  return 'ask';
}

/**
 * - `carry-on`: the entry is still open; saying "I kept working" needs
 *   nothing done, the clock simply continues.
 * - `reopen`: the server has already closed it, so the stretch since has
 *   to be reclaimed before tracking can continue into it.
 */
export type KeepAction = 'carry-on' | 'reopen';

/**
 * What answering "yes, I was still working" has to do.
 *
 * The case this exists for: the backend ends a timer whose device has not
 * been heard from for half an hour, dating it at the last heartbeat. A
 * crash stops the heartbeat, so by the time somebody is asked about a
 * forty-minute gap, the entry they are being asked about has already been
 * closed underneath them. Answering "keep" used to do nothing at all —
 * the next poll reported no timer, the clock stopped, and the answer was
 * quietly discarded along with the time it was meant to claim.
 *
 * `answered` false means the server could not be reached, and that is
 * deliberately `carry-on`: the local entry stays open, and whenever the
 * person does stop, that stop extends the closed entry to the real time
 * (see the backend's `abandonedEntryToExtend`). Reopening blind would cut
 * the day in two for nothing.
 */
export function keepActionFor(serverTimer: {
  answered: boolean;
  running: boolean;
}): KeepAction {
  if (!serverTimer.answered) return 'carry-on';
  return serverTimer.running ? 'carry-on' : 'reopen';
}
