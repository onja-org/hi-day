/**
 * Where a timesheet page ended: the `(startedAt, id)` of its oldest entry.
 * The next page starts strictly after it in `startedAt DESC, id DESC`
 * order. `id` breaks ties, because a midnight split or a pause can leave
 * several entries with the same `startedAt`.
 */
export interface TimeEntryCursor {
  startedAt: Date;
  id: string;
}

const SEPARATOR = '_';

export function encodeTimeEntryCursor(cursor: TimeEntryCursor): string {
  return `${cursor.startedAt.toISOString()}${SEPARATOR}${cursor.id}`;
}

/** `null` for anything that isn't a cursor this API handed out. */
export function decodeTimeEntryCursor(raw: string): TimeEntryCursor | null {
  const at = raw.indexOf(SEPARATOR);
  if (at <= 0 || at === raw.length - 1) return null;
  const startedAt = new Date(raw.slice(0, at));
  if (Number.isNaN(startedAt.getTime())) return null;
  return { startedAt, id: raw.slice(at + 1) };
}
