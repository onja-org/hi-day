import type { TrackingResult } from './api-client';

/**
 * What the timer status poll answers. The queue is settled first, as
 * before; what is new is that while anything is still waiting to be sent,
 * the server is not asked at all.
 *
 * Its answer would be about a past the queue has not caught up with yet:
 * reads can succeed while queued writes don't — a server answering GETs as
 * it comes back, or a backoff after a 503 — and its "nothing is running"
 * replaced the timer this device had started offline. The timer cleared on
 * screen while its start was still waiting, and on a wake the person was
 * left untracked without being told. Once the queue is empty the server is
 * the truth again, and a timer started elsewhere shows up then.
 */
export async function readTimerStatus<T>(deps: {
  settleQueue: () => Promise<void>;
  hasPending: () => boolean;
  fromServer: () => Promise<TrackingResult<T>>;
  fromLocal: () => T;
}): Promise<TrackingResult<T>> {
  await deps.settleQueue();
  if (deps.hasPending()) {
    return { ok: true, data: deps.fromLocal(), fromCache: true };
  }
  return await deps.fromServer();
}
