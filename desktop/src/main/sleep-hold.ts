import type { IdlePolicy } from './api-client';
import type { IdleHold } from './idle-hold-store';

/**
 * What waking does to a timer left running across a sleep.
 *
 * Sleep is idle time, and idle time only stops the timer once it reaches
 * the organisation's timeout. So the machine going to sleep stops nothing:
 * it notes when input stopped (`timerRunning: true` on the hold) and
 * leaves the entry running. Ending it at the moment of sleep and starting
 * it again on wake was the old way, and the restart was a second request
 * made exactly when the network is least likely to be there — offline, it
 * could be lost, and the person came back to a stopped timer.
 *
 * - `carry-on`: back before the timeout. The entry never stopped, so there
 *   is nothing to do but forget the hold.
 * - `stop`: the timeout was reached. The entry is ended where input
 *   stopped, and the hold is then an ordinary sleep hold — the renderer
 *   asks Keep/Discard, or under auto-subtract says it was not counted.
 *   With no policy (or idle handling since turned off) there is nothing
 *   to measure against, and asking is the answer that loses nothing.
 * - `none`: no hold, or one whose timer was already stopped.
 */
export type SleepWakeAction = 'none' | 'carry-on' | 'stop';

export function sleepHoldOnWake(
  hold: IdleHold | null,
  policy: Pick<IdlePolicy, 'handling' | 'thresholdMinutes'> | null,
  nowMs: number,
): SleepWakeAction {
  if (!hold?.timerRunning) return 'none';
  if (!policy || policy.handling === 'off') return 'stop';
  const returnedMs = hold.returnedAt ? Date.parse(hold.returnedAt) : nowMs;
  const awayMs = returnedMs - Date.parse(hold.idleStartedAt);
  return awayMs < policy.thresholdMinutes * 60_000 ? 'carry-on' : 'stop';
}

/** Power signals closer together than this are one signal reported twice. */
const REPEAT_SIGNAL_MS = 5_000;

/**
 * Linux can report one sleep, or one wake, twice a second or so apart.
 * A repeated wake settled the sleep again — before a short sleep left the
 * timer running, that meant two restarts — and still redraws the prompt or
 * repeats the "not counted" notice; a repeated sleep wrote the hold again.
 * The second of each is ignored.
 */
export function isRepeatSignal(lastAtMs: number | null, nowMs: number): boolean {
  return lastAtMs !== null && nowMs - lastAtMs < REPEAT_SIGNAL_MS;
}
