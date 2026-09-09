import type { UrlSession } from './session-types';

/**
 * The wire contract for POST /device/url-sessions/sync — see
 * docs/url-tracking-api.md for the full write-up (idempotency semantics,
 * clamping, and how a UrlSession joins time entries).
 */
export interface SyncRequestBody {
  sessions: UrlSession[];
}

export interface SyncResponseBody {
  /** Ids the server has durably persisted — a possibly-partial subset of the batch sent. */
  acked: string[];
}

export type SyncBatchResult = SyncResponseBody;

/**
 * Whatever actually talks to the network — injected so the queue's retry/
 * idempotency behavior is testable without a real backend. A real
 * implementation lives alongside ApiClient once the backend endpoint exists.
 */
export type UploadFn = (batch: UrlSession[]) => Promise<SyncBatchResult>;
