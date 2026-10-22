import { intervalFromEnv } from './tuning';

/**
 * Below this, a timer found still running at startup is simply kept.
 * Under a couple of minutes nothing is in doubt — they relaunched the app
 * themselves — and a prompt that fires for trivia is one people learn to
 * click through unread. Ending it there instead would dock somebody ten
 * minutes a day on a machine that crashes often.
 */
export const CRASH_RECOVERY_FLOOR_MS = intervalFromEnv(
  'WM_CRASH_RECOVERY_FLOOR_MS',
  2 * 60 * 1000,
);

/**
 * Above this the gap is too long to be plausibly "it crashed and I
 * restarted it", so the entry is ended where the app was last seen alive.
 * Matches Hubstaff's published one-hour rule.
 */
export const CRASH_RECOVERY_WINDOW_MS = intervalFromEnv(
  'WM_CRASH_RECOVERY_WINDOW_MS',
  60 * 60 * 1000,
);

export type RecoveryAction = 'keep' | 'ask' | 'end';

/**
 * What to do with a timer found still running at startup — which only
 * happens after a crash, since every ordinary quit stops it first.
 *
 * `silentForMs` is time since the app was last *alive*, not since the
 * server last answered: measuring from contact would read an outage as a
 * crash and end an hour of offline work at the moment the connection
 * dropped. The ceiling is checked first so a floor misconfigured above it
 * cannot silently keep a gap of any size.
 */
export function recoveryActionFor(
  silentForMs: number,
  floorMs: number = CRASH_RECOVERY_FLOOR_MS,
  ceilingMs: number = CRASH_RECOVERY_WINDOW_MS,
): RecoveryAction {
  if (silentForMs > ceilingMs) return 'end';
  // A backwards clock reads as no gap, which neither ends nor queries an
  // entry on the strength of a number that cannot be trusted.
  if (silentForMs < floorMs) return 'keep';
  return 'ask';
}

export type KeepAction = 'carry-on' | 'reopen';

/**
 * What answering "yes, I was still working" has to do.
 *
 * Past the backend's half-hour grace the sweeper has already closed the
 * entry being asked about, so keeping it means reclaiming the stretch
 * since; otherwise the answer is silently discarded with the time it was
 * meant to claim. Unreachable is `carry-on`: the local entry stays open
 * and whenever they stop, that stop extends the closed one anyway.
 */
export function keepActionFor(serverTimer: {
  answered: boolean;
  running: boolean;
}): KeepAction {
  if (!serverTimer.answered) return 'carry-on';
  return serverTimer.running ? 'carry-on' : 'reopen';
}
