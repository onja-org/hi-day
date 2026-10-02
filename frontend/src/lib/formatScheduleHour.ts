/** An hour of day (0–23) as a 12-hour label, e.g. 0 → "12:00 AM", 15 → "3:00 PM". */
export function formatScheduleHour(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 === 0 ? 12 : hour % 12}:00 ${suffix}`;
}
