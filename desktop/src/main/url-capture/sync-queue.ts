import type { UrlSession } from './session-types';
import type { UploadFn } from './sync-contract';
import type { UrlSessionRow, UrlSessionStore } from './store';

const DEFAULT_BATCH_SIZE = 50;

export interface SyncQueueResult {
  uploaded: number;
  acked: number;
}

/**
 * Pulls a pending batch and uploads it — deliberately just the primitive.
 * Whoever calls `runOnce` on a schedule (with jitter/backoff) is separate
 * wiring, not part of this class: see docs/url-tracking-plan.md §8's "agents
 * stagger sync with jitter" and the open integration gap noted alongside it.
 */
export class SyncQueue {
  constructor(
    private readonly store: UrlSessionStore,
    private readonly upload: UploadFn,
    private readonly batchSize: number = DEFAULT_BATCH_SIZE,
  ) {}

  async runOnce(): Promise<SyncQueueResult> {
    const batch = this.store.getPendingSync(this.batchSize);
    if (batch.length === 0) {
      return { uploaded: 0, acked: 0 };
    }

    // If `upload` throws (network failure, or a simulated crash mid-batch in
    // tests), nothing below runs — every row in this batch stays exactly as
    // pending as it was, and the next call re-sends it unchanged.
    const result = await this.upload(batch.map(toWireSession));

    this.store.markSynced(result.acked, Date.now());
    return { uploaded: batch.length, acked: result.acked.length };
  }
}

/**
 * Strips local-only bookkeeping before a row goes on the wire. `syncedAt`
 * is structurally assignable to `UrlSession`, so it compiled fine and the
 * server rejected the batch at runtime (`forbidNonWhitelisted`).
 *
 * Fields are listed explicitly so a future local-only column cannot leak
 * the same way.
 */
function toWireSession(row: UrlSessionRow): UrlSession {
  return {
    id: row.id,
    url: row.url,
    host: row.host,
    path: row.path,
    title: row.title,
    browser: row.browser,
    private: row.private,
    deviceId: row.deviceId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    activeMs: row.activeMs,
    tzOffsetMin: row.tzOffsetMin,
    source: row.source,
    confidence: row.confidence,
  };
}
