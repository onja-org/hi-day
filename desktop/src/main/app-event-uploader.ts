import type { AppEventPayload, TrackingResult } from './api-client';
import type { WindowSample } from './window-sample';

export const DEFAULT_APP_EVENT_FLUSH_INTERVAL_MS = 60_000;
/**
 * Matches the backend's own `MAX_EVENTS_PER_BATCH`
 * (backend/src/app-events/dto/create-app-events-batch.dto.ts) — flushing
 * early if the buffer ever reaches this keeps a single batch acceptable to
 * the backend even if the flush interval is misconfigured or the process
 * goes a long time without a successful flush.
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
  // Nothing meaningful to report — happens under Wayland, where get-windows
  // returns no information at all (see docs/adr/0009-...). WindowSampler
  // still called its sink for this tick (never skips one); just not worth
  // an empty row in app_events.
  if (sample.appName === null) return null;

  return {
    appName: sample.appName,
    title: sample.title ?? undefined,
    titleUnavailableReason: sample.titleUnavailableReason ?? undefined,
    sampledAt: sample.sampledAt,
  };
}

/**
 * Buffers window samples in memory and POSTs them in batches to
 * `/device/app-events`, matching the agent's batched-ingest design
 * (docs/TECH_DESIGN.md §4: "accumulate events and POST them in batches").
 *
 * No offline queue yet (see desktop/README.md's "Known limitations") — a
 * failed flush just drops that batch rather than retrying or persisting it,
 * same as the rest of the agent's network calls today.
 */
export class AppEventUploader {
  private buffer: AppEventPayload[] = [];
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly authStore: AppEventUploaderSession,
    private readonly apiClient: AppEventUploaderClient,
    private readonly flushIntervalMs = DEFAULT_APP_EVENT_FLUSH_INTERVAL_MS,
  ) {}

  /** The sink handed directly to WindowSampler in main.ts. */
  enqueue = (sample: WindowSample): void => {
    const payload = toPayload(sample);
    if (!payload) return;

    this.buffer.push(payload);
    if (this.buffer.length >= MAX_BUFFERED_APP_EVENTS) {
      void this.flush();
    }
  };

  start(): void {
    if (this.handle) return;
    this.handle = setInterval(() => void this.flush(), this.flushIntervalMs);
  }

  stop(): void {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const session = this.authStore.load();
    if (!session) {
      // No session to upload against (e.g. logged out with a stale
      // buffer) — drop rather than let it grow unboundedly.
      this.buffer = [];
      return;
    }

    const batch = this.buffer;
    this.buffer = [];

    const result = await this.apiClient.postAppEvents(
      session.deviceToken,
      batch,
    );
    if (!result.ok) {
      console.error('[app-event-upload] batch of', batch.length, 'dropped:', result.message);
    }
  }
}
