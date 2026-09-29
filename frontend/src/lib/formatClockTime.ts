/** A wall-clock time in the viewer's own locale and zone, e.g. "1:21 PM" —
 * the format both ends of a timesheet row's time range use. */
export function formatClockTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
