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
 * Strips local-only bookkeeping before a row goes on the wire.
 *
 * `getPendingSync` returns `UrlSessionRow`, which is a `UrlSession` PLUS
 * `syncedAt` — a column that exists purely to track upload state on this
 * device. TypeScript happily passes the wider type where `UrlSession[]` is
 * expected (extra properties are allowed structurally), so nothing failed
 * at compile time; the server rejected the whole batch at runtime with
 * `property syncedAt should not exist`, because the sync DTO validates
 * with `forbidNonWhitelisted`.
 *
 * Enumerating the fields explicitly — rather than deleting one key — means
 * any future local-only column added to the store cannot silently leak
 * into the request the same way.
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
