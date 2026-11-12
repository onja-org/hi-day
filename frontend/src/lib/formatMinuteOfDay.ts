/**
 * Minutes from midnight as a wall-clock time, e.g. 540 → "9:00 AM" — for
 * figures that are already on the organisation's calendar, so no zone is
 * applied. Past 24 hours wraps, since a "usual stop" can't exceed a day.
 */
export function formatMinuteOfDay(minute: number, locale?: string): string {
  const wrapped = ((Math.round(minute) % 1440) + 1440) % 1440;
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, 0, wrapped)));
}
