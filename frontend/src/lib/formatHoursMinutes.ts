/** Seconds as "H:MM" — "4:30", "18:05", "0:40". Partial minutes round down. */
export function formatHoursMinutes(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}
