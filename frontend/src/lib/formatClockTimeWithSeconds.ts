/** A wall-clock time including seconds, e.g. "9:03:44 am". Used where the
 * exact span matters — the delete dialog, which is the last chance to notice
 * you picked the wrong entry of two that start in the same minute. */
export function formatClockTimeWithSeconds(value: string | Date): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
