import type { WeekStart } from "@/types/organisation";
import {
  addDaysToKey,
  dateKeyInZone,
  detectTimezone,
  endOfDayInZone,
  startOfDayInZone,
  startOfWeekKey,
} from "./timezone";

/**
 * Week boundaries on the organisation's week-start day, `offset` weeks from
 * the week containing `anchor` — the prev/next navigation the Weekly matrix
 * and Calendar grid need, where the Daily tab uses
 * `getTimesheetDateRange`'s presets.
 *
 * Found in calendar days and turned into instants only at the end, so a
 * week spanning a DST change is still seven days rather than 168 hours.
 */
export function getWeekRange(
  anchor: Date,
  offset = 0,
  zone: string = detectTimezone(),
  weekStart: WeekStart = "monday",
): { start: Date; end: Date } {
  const startKey = addDaysToKey(
    startOfWeekKey(dateKeyInZone(anchor, zone), weekStart),
    offset * 7,
  );
  const endKey = addDaysToKey(startKey, 6);
  return {
    start: startOfDayInZone(startKey, zone),
    // Inclusive: the backend filters with `Between`, so an exclusive end
    // would pull in the next week's first entry.
    end: new Date(endOfDayInZone(endKey, zone).getTime() - 1),
  };
}
