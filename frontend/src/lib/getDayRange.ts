function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Single-day boundaries, navigable by a day `offset` from `anchor` — the
 * Activities pages' (Apps/URLs/Screenshots/Notes) day-navigation control.
 */
export function getDayRange(anchor: Date, offset = 0): { start: Date; end: Date } {
  const start = startOfDay(anchor);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1);
  return { start, end };
}

/**
 * The `YYYY-MM-DD` date string for a day `offset` from `anchor` — always
 * derived from the *UTC* calendar day (`toISOString().slice(0, 10)`),
 * matching the backend's own `resolveDate` default exactly (see
 * app-events/screenshots/url-sessions/notes services). This app has no
 * per-viewer timezone feature (a deliberate scope decision — see the
 * Activities-redesign plan), so every day boundary in the product is the
 * server's own UTC day; this function keeps the client and server "today"
 * identical by construction, by always sending this string explicitly as
 * `?date=` rather than relying on the server default (which would silently
 * disagree with a non-UTC viewer's local "today" near midnight).
 */
export function getDayRangeDateString(anchor: Date, offset = 0): string {
  const date = new Date(anchor);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
