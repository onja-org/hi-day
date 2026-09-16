import type { ActivitySamplePayload, TrackingResult } from './api-client';
import type { OfflineQueue, QueuedItem, QueueSender } from './offline-queue';
import type { ActivitySample } from './activity-sample';

export const ACTIVITY_SAMPLE_QUEUE_KIND = 'activity-sample';

/** Sized against the backend's own per-batch cap (create-activity-samples-batch.dto.ts). */
export const MAX_BUFFERED_ACTIVITY_SAMPLES = 500;

export interface ActivitySampleUploaderSession {
  load(): { deviceToken: string } | null;
}

export interface ActivitySampleUploaderClient {
  postActivitySamples(
    deviceToken: string,
    samples: ActivitySamplePayload[],
  ): Promise<TrackingResult<void>>;
}

function toPayload(sample: ActivitySample): ActivitySamplePayload {
  return {
    activePercentage: sample.activePercentage,
    periodStart: sample.periodStart,
    periodEnd: sample.periodEnd,
  };
}

/** Same batched-ingest shape as AppEventUploader, POSTing to `/device/activity-samples`. */
export class ActivitySampleUploader
  implements QueueSender<ActivitySamplePayload>
{
  readonly kind = ACTIVITY_SAMPLE_QUEUE_KIND;
  readonly maxBatchSize = MAX_BUFFERED_ACTIVITY_SAMPLES;

  constructor(
    private readonly authStore: ActivitySampleUploaderSession,
    private readonly apiClient: ActivitySampleUploaderClient,
    private readonly offlineQueue: OfflineQueue,
  ) {}

  /** The sink handed directly to ActivitySampler in main.ts. */
  enqueue = (sample: ActivitySample): void => {
    this.offlineQueue.enqueue(this.kind, toPayload(sample));
  };

  /** Called the moment activity tracking turns off, so a partial batch doesn't sit around. */
  flush(): Promise<void> {
    return this.offlineQueue.flushKind(this.kind);
  }

  async send(items: QueuedItem<ActivitySamplePayload>[]): Promise<boolean> {
    const session = this.authStore.load();
    if (!session) return false; // leave it queued; sends once a session exists again

    const result = await this.apiClient.postActivitySamples(
      session.deviceToken,
      items.map((item) => item.payload),
    );
    if (!result.ok) {
      if (result.status === 403) {
        // A permanent rejection, not a transient failure like a network
        // blip — retrying would fail forever while rejected samples pile up
        // locally, so discard instead.
        console.warn(
          '[activity-sample-upload] batch of',
          items.length,
          'rejected with 403, discarding',
        );
        return true;
      }
      console.error(
        '[activity-sample-upload] batch of',
        items.length,
        'failed, will retry:',
        result.message,
      );
    }
    return result.ok;
  }
}
