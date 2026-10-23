import type { UrlSession } from './session-types';

export type SyncAttempt =
  | { ok: true; acked: string[] }
  | { ok: false; status?: number };

/**
 * Sends a batch, and if a backend older than `confidence: 'unknown'` rejects
 * it, sends it again without those sessions.
 *
 * The sync endpoint validates every session, so one it does not recognise
 * fails the whole batch with a 400 — and the queue resends the same batch
 * each tick, so a single unknown-URL session would stop every real URL from
 * that device uploading until the backend caught up. The unknown ones are
 * acked rather than left pending: that backend could never store them, and
 * left pending they would fill whole batches ahead of real sessions. Only
 * the time between a desktop release and the backend's is lost.
 */
export async function syncWithOlderBackendFallback(
  batch: UrlSession[],
  send: (sessions: UrlSession[]) => Promise<SyncAttempt>,
): Promise<SyncAttempt> {
  const first = await send(batch);
  if (first.ok || first.status !== 400) return first;

  const unknownIds = batch
    .filter((session) => session.confidence === 'unknown')
    .map((session) => session.id);
  if (unknownIds.length === 0) return first;

  const known = batch.filter((session) => session.confidence !== 'unknown');
  if (known.length === 0) return { ok: true, acked: unknownIds };

  const retry = await send(known);
  return retry.ok ? { ok: true, acked: [...retry.acked, ...unknownIds] } : retry;
}
