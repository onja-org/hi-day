/**
 * How a Time entry's time came about, as distinct from `TimeEntrySource`,
 * which says where it was tracked.
 *
 * `idle` is a stretch the person was away for. Discarding idle time keeps it
 * as its own entry marked this way rather than deleting it, so the gap stays
 * visible and reviewable — Hubstaff does the same.
 *
 * `resumed` is an entry the person kept after being warned it went idle, so
 * it contains idle time on purpose. `manual` mirrors `source: manual` and is
 * set at creation so one column answers "what kind of time is this".
 */
export enum TimeEntryType {
  NORMAL = 'normal',
  IDLE = 'idle',
  RESUMED = 'resumed',
  MANUAL = 'manual',
}
