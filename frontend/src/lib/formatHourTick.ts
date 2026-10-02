/** Seconds as a whole-hour axis label, e.g. 25200 → "7:00". */
export function formatHourTick(seconds: number): string {
  return `${Math.round(seconds / 3600)}:00`;
}
