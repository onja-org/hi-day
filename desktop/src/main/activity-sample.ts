/**
 * Hubstaff's method (https://support.hubstaff.com/how-are-activity-levels-calculated/):
 * a 10-minute period is 60 ten-second segments; a segment is active if it
 * saw any mouse move/click/wheel or key press. `activePercentage` is
 * `activeSegments / 60 * 100` — never which key/button or where the mouse was.
 */
export const SEGMENTS_PER_PERIOD = 60;
export const DEFAULT_ACTIVITY_PERIOD_MS = 600_000; // Hubstaff's own fixed 10-minute window
export const SEGMENT_DURATION_MS = DEFAULT_ACTIVITY_PERIOD_MS / SEGMENTS_PER_PERIOD;

export interface ActivitySample {
  activePercentage: number;
  periodStart: string;
  periodEnd: string;
}

export type ActivitySampleSink = (sample: ActivitySample) => void;

/**
 * `DESKTOP_ACTIVITY_PERIOD_MS`, when set, overrides the 10-minute period —
 * dev/testing only (e.g. `DESKTOP_ACTIVITY_PERIOD_MS=60000` for 1-minute
 * periods instead of waiting 10 minutes to see a reading). Segment count
 * stays fixed at 60 regardless (segment duration = period / 60), so
 * `activePercentage` still means the same thing at any period length.
 */
export function resolveActivityPeriodMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.DESKTOP_ACTIVITY_PERIOD_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ACTIVITY_PERIOD_MS;
}

/** Clamped to the last segment for an event landing right at (or past, from clock drift) the period boundary. */
export function segmentIndexForOffset(
  offsetMs: number,
  periodMs: number = DEFAULT_ACTIVITY_PERIOD_MS,
): number {
  const segmentDurationMs = periodMs / SEGMENTS_PER_PERIOD;
  const index = Math.floor(offsetMs / segmentDurationMs);
  return Math.min(SEGMENTS_PER_PERIOD - 1, Math.max(0, index));
}

export function computeActivePercentage(
  activeSegments: ReadonlySet<number>,
): number {
  return Math.round((activeSegments.size / SEGMENTS_PER_PERIOD) * 100);
}
