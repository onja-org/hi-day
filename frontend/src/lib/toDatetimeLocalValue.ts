/**
 * Formats an ISO instant as the local wall-clock value a
 * `<input type="datetime-local">` expects (`YYYY-MM-DDTHH:mm`) — using the
 * viewer's own local time, not UTC, since that's what they'd actually see
 * on their clock for when they started/stopped working.
 */
export function toDatetimeLocalValue(isoString: string): string {
  const date = new Date(isoString);
  const pad = (value: number) => String(value).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
