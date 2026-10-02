const SECONDS_PER_HOUR = 3600;

/** Whole-hour Y-axis ticks in seconds, from 0 up to the first hour at or above `maxSeconds` (at least 1h). */
export function buildHourTicks(maxSeconds: number): number[] {
  const hours = Math.max(1, Math.ceil(maxSeconds / SECONDS_PER_HOUR));
  return Array.from({ length: hours + 1 }, (_, hour) => hour * SECONDS_PER_HOUR);
}
