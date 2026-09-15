import type { AppEventPayload, TrackingResult } from './api-client';
import type { OfflineQueue, QueuedItem, QueueSender } from './offline-queue';
import type { WindowSample } from './window-sample';

export const APP_EVENT_QUEUE_KIND = 'app-event';

/**
 * Matches the backend's own `MAX_EVENTS_PER_BATCH`
 * (backend/src/app-events/dto/create-app-events-batch.dto.ts) — capping
 * `send`'s batch size at this keeps a single batch acceptable to the
 * backend even if the flush interval is misconfigured or the queue has
 * built up a large backlog after an extended offline stretch.
 */
export const MAX_BUFFERED_APP_EVENTS = 500;

export interface AppEventUploaderSession {
  load(): { deviceToken: string } | null;
}

export interface AppEventUploaderClient {
  postAppEvents(
    deviceToken: string,
    events: AppEventPayload[],
  ): Promise<TrackingResult<void>>;
}

function toPayload(sample: WindowSample): AppEventPayload | null {
  // Nothing meaningful to report — happens under Wayland, which no
  // available library can read window/app info from at all (see
  // docs/adr/0009-..., docs/adr/0011-...). WindowSampler still called its
  // sink for this tick (never skips one); just not worth an empty row in
  // app_events.
  if (sample.appName === null) return null;

  return {
    appName: sample.appName,
    title: sample.title ?? undefined,
    titleUnavailableReason: sample.titleUnavailableReason ?? undefined,
    sampledAt: sample.sampledAt,
  };
}

/**
 * Persists window samples to the offline queue and, on each queue tick,
 * POSTs whatever's due in batches to `/device/app-events`, matching the
 * agent's batched-ingest design (docs/TECH_DESIGN.md §4: "accumulate
 * events and POST them in batches"). Samples survive an app restart or a
 * dropped connection between capture and upload — see `OfflineQueue` for
 * the persistence/retry/jitter machinery this class plugs into.
 */
export class AppEventUploader implements QueueSender<AppEventPayload> {
  readonly kind = APP_EVENT_QUEUE_KIND;
  readonly maxBatchSize = MAX_BUFFERED_APP_EVENTS;

  constructor(
    private readonly authStore: AppEventUploaderSession,
    private readonly apiClient: AppEventUploaderClient,
    private readonly offlineQueue: OfflineQueue,
  ) {}

  /** The sink handed directly to WindowSampler in main.ts. */
  enqueue = (sample: WindowSample): void => {
    const payload = toPayload(sample);
    if (!payload) return;
    this.offlineQueue.enqueue(this.kind, payload);
  };

  /**
   * Pushes out whatever's currently queued right away, rather than waiting
   * for the offline queue's own tick — main.ts calls this the moment
   * window tracking turns off, so a partial batch doesn't sit around
   * unnecessarily.
   */
  flush(): Promise<void> {
    return this.offlineQueue.flushKind(this.kind);
  }

  async send(items: QueuedItem<AppEventPayload>[]): Promise<boolean> {
    const session = this.authStore.load();
    if (!session) {
      // No session to upload against right now (e.g. logged out with a
      // queued backlog) — leave it queued rather than dropping already-
      // captured data; it sends once a session exists again.
      return false;
    }

    const result = await this.apiClient.postAppEvents(
      session.deviceToken,
      items.map((item) => item.payload),
    );
    if (!result.ok) {
      if (result.status === 403) {
        // Consent-gated rejection (see docs/adr/0014-...), not a transient
        // failure like a network blip — retrying would fail forever while
        // rejected samples pile up locally, so discard instead.
        console.warn(
          '[app-event-upload] batch of',
          items.length,
          'rejected — no consent for the current disclosure version, discarding',
        );
        return true;
      }
      console.error(
        '[app-event-upload] batch of',
        items.length,
        'failed, will retry:',
        result.message,
      );
    }
    return result.ok;
  }
}
