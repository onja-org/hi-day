import {
  addDaysToKey,
  dateKeyInZone,
  detectTimezone,
  endOfDayInZone,
  startOfDayInZone,
  startOfWeekKey,
} from "./timezone";

/**
 * Monday-start week boundaries, navigable by a week `offset` from the week
 * containing `anchor` — distinct from `getTimesheetDateRange`'s presets,
 * which drive the Daily tab. The Weekly matrix and Calendar grid need real
 * prev/next-week navigation instead, and a timesheet week is conventionally
 * read Monday-first.
 *
 * The week is found in calendar days, which carry no timezone, and only
 * converted back to instants at the end — so "this week" means the viewed
 * zone's week, and a week containing a daylight-saving change is still
 * seven days rather than 168 hours.
 */
export function getWeekRange(
  anchor: Date,
  offset = 0,
  zone: string = detectTimezone(),
): { start: Date; end: Date } {
  const startKey = addDaysToKey(
    startOfWeekKey(dateKeyInZone(anchor, zone)),
    offset * 7,
  );
  const endKey = addDaysToKey(startKey, 6);
  return {
    start: startOfDayInZone(startKey, zone),
    // Inclusive, matching getTimesheetDateRange: the backend filters with
    // `Between`, so an exclusive end would pull in the next Monday's first
    // entry.
    end: new Date(endOfDayInZone(endKey, zone).getTime() - 1),
  };
}
