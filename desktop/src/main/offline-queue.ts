import type { OfflineQueueStore } from './offline-queue-store';

/** Matches the agent's existing batched-ingest cadence (docs/TECH_DESIGN.md §4). */
export const DEFAULT_FLUSH_INTERVAL_MS = 60_000;
export const DEFAULT_BASE_RETRY_DELAY_MS = 30_000;
export const DEFAULT_MAX_RETRY_DELAY_MS = 30 * 60_000;
/** Safety valve against unbounded local disk growth during a very long offline stretch — a generous default a sender can override. */
export const DEFAULT_MAX_QUEUED_ITEMS_PER_KIND = 20_000;
const TICK_JITTER_RATIO = 0.2;

export interface QueuedItem<T = unknown> {
  id: number;
  payload: T;
  blob: Buffer | null;
  attempts: number;
}

export interface QueueSender<T = unknown> {
  /** Discriminates this sender's rows in the shared queue table — e.g. 'app-event', 'screenshot'. */
  kind: string;
  /** Max items passed to `send` in one call. */
  maxBatchSize: number;
  /** Overrides `DEFAULT_MAX_QUEUED_ITEMS_PER_KIND` for this kind. */
  maxQueuedItems?: number;
  /**
   * If true, `enqueue` also tries to send this kind right away (best
   * effort, fire-and-forget) instead of only waiting for the next periodic
   * tick — for a low-volume kind (screenshots) this keeps the old
   * "uploads shortly after capture" feel while online; a high-volume kind
   * (app-events) leaves this unset so samples still batch instead of
   * firing one request per sample.
   */
  flushOnEnqueue?: boolean;
  /** Attempts to send `items` (at most `maxBatchSize`); resolve `true` only once the backend has durably accepted them. */
  send(items: QueuedItem<T>[]): Promise<boolean>;
}

/**
 * Exponential backoff, capped, with full jitter — a random value between
 * `baseDelayMs` and the capped exponential ceiling, not a fixed multiple of
 * it. Plain exponential backoff has every device that failed at the same
 * moment (e.g. the backend just went down) retry in lockstep; jitter
 * staggers them so reconnecting doesn't stampede the server the instant it
 * comes back (docs/TECH_DESIGN.md §8, §4).
 */
export function computeRetryDelayMs(
  attempts: number,
  baseDelayMs = DEFAULT_BASE_RETRY_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_RETRY_DELAY_MS,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempts - 1));
  return Math.round(baseDelayMs + random() * (ceiling - baseDelayMs));
}

function jitteredDelayMs(
  baseMs: number,
  ratio: number,
  random: () => number,
): number {
  const delta = baseMs * ratio;
  return Math.round(baseMs + (random() * 2 - 1) * delta);
}

/**
 * The desktop agent's offline queue (docs/TECH_DESIGN.md §4): every capture
 * is persisted to SQLite (`OfflineQueueStore`) before it's sent, and drained
 * in batches on a periodic, jittered tick. A dropped connection just leaves
 * data queued rather than losing it; a batch that fails to send (network
 * down, backend unreachable, no session) retries later with backoff instead
 * of being dropped.
 *
 * One queue instance serves every capture kind via `registerSender` — each
 * kind owns its own batch size, queue cap, and `send` implementation (an
 * `AppEventUploader`/`ScreenshotUploader` today; a future activity-level or
 * URL-event capture module would register the same way), but they share
 * this same persistence, retry, and jitter machinery.
 *
 * Known limitation: delivery is at-least-once, not exactly-once. If the
 * backend durably accepts a batch but the acknowledgement is lost before
 * this process can delete the queued rows (a crash in that exact window,
 * or a dropped response on an otherwise-successful request), the batch is
 * retried and the backend sees it twice — the ingest endpoints have no
 * idempotency key to de-duplicate on. This is the same trade-off most
 * at-least-once ingestion pipelines make; closing it needs an idempotency
 * key on the backend's batch/record endpoints, which is a backend change
 * out of scope here (see CONTEXT.md/backend CLAUDE.md — this ticket only
 * depends on that endpoint, it doesn't change it).
 */
export class OfflineQueue {
  private readonly senders = new Map<string, QueueSender>();
  private readonly inFlight = new Map<string, Promise<void>>();
  private handle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: OfflineQueueStore,
    private readonly flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
    private readonly random: () => number = Math.random,
  ) {}

  registerSender(sender: QueueSender): void {
    this.senders.set(sender.kind, sender);
  }

  /** Persists one captured item for `kind` — the durability step every capture sink calls before any network request is attempted. */
  enqueue(kind: string, payload: unknown, blob: Buffer | null = null): void {
    const sender = this.senders.get(kind);
    const maxQueuedItems = sender?.maxQueuedItems ?? DEFAULT_MAX_QUEUED_ITEMS_PER_KIND;
    this.store.enqueue(kind, JSON.stringify(payload), blob, new Date(), maxQueuedItems);

    if (sender?.flushOnEnqueue) {
      void this.flushKind(kind);
    }
  }

  start(): void {
    if (this.handle) return;
    this.scheduleNextTick();
  }

  stop(): void {
    if (this.handle) clearTimeout(this.handle);
    this.handle = null;
  }

  private scheduleNextTick(): void {
    const delay = jitteredDelayMs(this.flushIntervalMs, TICK_JITTER_RATIO, this.random);
    this.handle = setTimeout(() => {
      void this.flushAll().finally(() => {
        // Re-arm only if `stop()` wasn't called from inside this tick.
        if (this.handle !== null) this.scheduleNextTick();
      });
    }, delay);
  }

  async flushAll(): Promise<void> {
    for (const kind of this.senders.keys()) {
      await this.flushKind(kind);
    }
  }

  /**
   * Drains as many ready batches of `kind` as are queued, one batch at a
   * time, stopping as soon as one fails — that batch's own backoff governs
   * when this kind is worth retrying, and there's no reason to keep hammering
   * a backend that just rejected/timed out on the previous batch.
   *
   * Concurrency-guarded per kind: `flushOnEnqueue` firing right as the
   * periodic tick also flushes, or two enqueues in quick succession, must
   * never run two overlapping drains of the same kind — each would call
   * the store's `takeBatch` before the other has removed/rescheduled its
   * rows, sending the same queued item twice. A second call for a kind
   * already draining just attaches to that in-flight run instead of
   * starting its own.
   */
  flushKind(kind: string): Promise<void> {
    const existing = this.inFlight.get(kind);
    if (existing) return existing;

    const sender = this.senders.get(kind);
    if (!sender) return Promise.resolve();

    const run = this.drainKind(kind, sender).finally(() => {
      this.inFlight.delete(kind);
    });
    this.inFlight.set(kind, run);
    return run;
  }

  private async drainKind(kind: string, sender: QueueSender): Promise<void> {
    for (;;) {
      const rows = this.store.takeBatch(kind, sender.maxBatchSize, new Date());
      if (rows.length === 0) return;

      const items: QueuedItem[] = rows.map((row) => ({
        id: row.id,
        attempts: row.attempts,
        blob: row.blob,
        payload: JSON.parse(row.payload) as unknown,
      }));

      let ok: boolean;
      try {
        ok = await sender.send(items);
      } catch (error) {
        console.error(`[offline-queue] ${kind} send threw, will retry:`, error);
        ok = false;
      }

      if (!ok) {
        this.store.scheduleRetry(
          items.map((item) => ({
            id: item.id,
            nextAttemptAt: new Date(
              Date.now() + computeRetryDelayMs(item.attempts + 1, undefined, undefined, this.random),
            ),
          })),
        );
        return;
      }

      this.store.remove(items.map((item) => item.id));
      if (rows.length < sender.maxBatchSize) return; // drained
      // Batch was full — more may be waiting right behind it, try again now.
    }
  }
}
