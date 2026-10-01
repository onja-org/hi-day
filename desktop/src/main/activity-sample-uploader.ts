import type { ActivitySample } from './activity-sampler';
import type { TrackingResult } from './api-client';
import type { OfflineQueue, QueuedItem, QueueSender } from './offline-queue';

export const ACTIVITY_SAMPLE_QUEUE_KIND = 'activity-sample';

/** Matches the backend's MAX_SAMPLES_PER_BATCH, so a long offline backlog
 * can't produce a batch the server rejects outright. */
export const MAX_BUFFERED_ACTIVITY_SAMPLES = 200;

export interface ActivitySampleUploaderSession {
  load(): { deviceToken: string } | null;
}

export interface ActivitySampleUploaderClient {
  postActivitySamples(
    deviceToken: string,
    samples: ActivitySample[],
  ): Promise<TrackingResult<void>>;
}

/**
 * Queues activity samples and POSTs them on the offline queue's own tick,
 * the same shape as `AppEventUploader`. No flush-on-enqueue: a sample
 * arrives once every ten minutes, so there is no batching to chase the way
 * there is for five-second window samples.
 */
export class ActivitySampleUploader implements QueueSender<ActivitySample> {
  readonly kind = ACTIVITY_SAMPLE_QUEUE_KIND;
  readonly maxBatchSize = MAX_BUFFERED_ACTIVITY_SAMPLES;

  constructor(
    private readonly authStore: ActivitySampleUploaderSession,
    private readonly apiClient: ActivitySampleUploaderClient,
    private readonly offlineQueue: OfflineQueue,
  ) {}

  /** The sink handed directly to ActivitySampler in main.ts. */
  enqueue = (sample: ActivitySample): void => {
    this.offlineQueue.enqueue(this.kind, sample);
  };

  flush(): Promise<void> {
    return this.offlineQueue.flushKind(this.kind);
  }

  async send(items: QueuedItem<ActivitySample>[]): Promise<boolean> {
    const session = this.authStore.load();
    if (!session) {
      // Logged out with a backlog — keep it queued rather than dropping
      // already-measured periods; it sends once a session exists again.
      return false;
    }

    const result = await this.apiClient.postActivitySamples(
      session.deviceToken,
      items.map((item) => item.payload),
    );
    if (!result.ok) {
      if (result.status === 403) {
        // Permanently rejected, not a transient blip — retrying would fail
        // forever while samples pile up locally.
        console.warn(
          '[activity-upload] batch of',
          items.length,
          'rejected with 403, discarding',
        );
        return true;
      }
      console.error(
        '[activity-upload] batch of',
        items.length,
        'failed, will retry:',
        result.message,
      );
    }
    return result.ok;
  }
}
