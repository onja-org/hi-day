/**
 * An `AppEvent` row is a *run* of identical window samples: `sampleCount`
 * consecutive ticks of the desktop agent's window sampler, the first taken
 * at `sampledAt` and each next one `APP_EVENT_SAMPLE_SECONDS` later. Older
 * agents send one row per tick, which is simply a run of one — the column
 * defaults to 1, so every row written before runs existed reads unchanged.
 *
 * Merging runs on the agent cuts `app_events` writes by an order of
 * magnitude, but everything that *reads* app time was written for points,
 * not spans: per-hour buckets, Time-entry coverage, project attribution,
 * session counting. Rather than teach each of them about spans — and get
 * the edges subtly wrong wherever an hour, a day or an edited entry falls
 * inside a run — readers expand a run back into the samples it stands for
 * and carry on exactly as before. That makes "a merged run" and "the same
 * samples sent one by one" indistinguishable to every report, which is the
 * whole guarantee.
 */

/** Foreground time each sample stands for — the agent's sampling interval
 * (desktop/src/main/window-sampler.ts's DEFAULT_WINDOW_SAMPLE_INTERVAL_MS). */
export const APP_EVENT_SAMPLE_SECONDS = 5;

export const APP_EVENT_SAMPLE_MS = APP_EVENT_SAMPLE_SECONDS * 1000;

/** The longest run one row may carry: five minutes, so activity is never
 * more than that stale on the dashboards. Enforced on ingest. */
export const MAX_APP_EVENT_SAMPLE_COUNT = 60;

/**
 * How far before a window a run can start and still reach into it. A query
 * for `[start, end]` must look back this far, or the tail of a run that
 * began just before `start` is silently dropped.
 */
export const APP_EVENT_RUN_LOOKBACK_MS =
  (MAX_APP_EVENT_SAMPLE_COUNT - 1) * APP_EVENT_SAMPLE_MS;

export interface AppEventRun {
  sampledAt: Date;
  /** Missing or null reads as 1: a row from before runs existed. */
  sampleCount?: number | null;
}

export interface SampleWindow {
  start: Date;
  end: Date;
}

/** A query's lower bound, widened so runs reaching into `start` are found. */
export function runLookbackStart(start: Date): Date {
  return new Date(start.getTime() - APP_EVENT_RUN_LOOKBACK_MS);
}

/** How many samples a row stands for — never less than one. */
export function sampleCountOf(row: AppEventRun): number {
  const count = row.sampleCount ?? 1;
  return Number.isInteger(count) && count > 0 ? count : 1;
}

/**
 * The samples a run stands for, one copy of the row per sample with its own
 * `sampledAt` (and `sampleCount: 1`), in time order. With a `window`, only
 * the samples inside it (inclusive at both ends, like TypeORM's `Between`)
 * are returned.
 *
 * Given rows sorted by `sampledAt`, the result is sorted too: an agent never
 * starts a run before the previous one ended.
 */
export function expandAppEventSamples<T extends AppEventRun>(
  rows: T[],
  window?: SampleWindow,
): (T & { sampledAt: Date; sampleCount: number })[] {
  const from = window?.start.getTime() ?? -Infinity;
  const to = window?.end.getTime() ?? Infinity;
  const samples: (T & { sampledAt: Date; sampleCount: number })[] = [];

  for (const row of rows) {
    const first = row.sampledAt.getTime();
    const count = sampleCountOf(row);
    for (let index = 0; index < count; index += 1) {
      const at = first + index * APP_EVENT_SAMPLE_MS;
      if (at < from || at > to) continue;
      samples.push({ ...row, sampledAt: new Date(at), sampleCount: 1 });
    }
  }

  return samples;
}

/**
 * SQL for the same expansion, for queries that aggregate in the database.
 * Join it after `FROM "app_events" <alias>`, then use
 * `appEventSampleAtSql(alias)` wherever the row's `sampledAt` was used:
 *
 *   FROM "app_events" a
 *   ${appEventSamplesJoinSql('a')}
 *   WHERE ${appEventSampleAtSql('a')} BETWEEN $1 AND $2
 *
 * Remember to keep a plain `a."sampledAt"` bound as well — widened with
 * `runLookbackStart` — so the index on (membershipId, sampledAt) still
 * narrows the scan before rows are expanded.
 */
export function appEventSamplesJoinSql(alias: string): string {
  return `CROSS JOIN LATERAL generate_series(0, GREATEST(${alias}."sampleCount", 1) - 1) AS "${alias}_sample"("index")`;
}

export function appEventSampleAtSql(alias: string): string {
  return `(${alias}."sampledAt" + "${alias}_sample"."index" * interval '${APP_EVENT_SAMPLE_SECONDS} seconds')`;
}
