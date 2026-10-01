import type { DateRange, DateRangePreset } from "@/types/dateRange";
import {
  addDaysToKey,
  dateKeyInZone,
  detectTimezone,
  endOfDayInZone,
  endOfMonthKey,
  endOfWeekKey,
  startOfDayInZone,
  startOfMonthKey,
  startOfWeekKey,
  subMonthsFromKey,
} from "./timezone";

/** The calendar days a preset covers, as YYYY-MM-DD. Timezone-free: a
 * preset is a statement about *days*, and only turning those days back into
 * instants needs a zone. */
function keysFor(preset: DateRangePreset, todayKey: string): [string, string] {
  switch (preset) {
    case "today":
      return [todayKey, todayKey];
    case "yesterday": {
      const yesterday = addDaysToKey(todayKey, -1);
      return [yesterday, yesterday];
    }
    case "last_7_days":
      return [addDaysToKey(todayKey, -6), todayKey];
    case "last_week": {
      const inLastWeek = addDaysToKey(todayKey, -7);
      return [startOfWeekKey(inLastWeek), endOfWeekKey(inLastWeek)];
    }
    case "last_2_weeks":
      return [
        startOfWeekKey(addDaysToKey(todayKey, -14)),
        endOfWeekKey(addDaysToKey(todayKey, -7)),
      ];
    case "this_month":
      return [startOfMonthKey(todayKey), todayKey];
    case "last_month": {
      const inLastMonth = subMonthsFromKey(todayKey, 1);
      return [startOfMonthKey(inLastMonth), endOfMonthKey(inLastMonth)];
    }
  }
}

/**
 * Resolves a preset into a `{from, to}` instant range, with the calendar
 * days read in `zone`.
 *
 * Two steps on purpose. A preset names *days* — "today", "last week" — and
 * days are timezone-free, so the arithmetic happens on date keys. Only the
 * final conversion back to instants needs a zone, and that is where a day's
 * real length is respected: a day the clocks change is 23 or 25 hours, not
 * 24.
 *
 * Defaults to the viewer's own zone, so callers with no timezone choice
 * behave exactly as before.
 */
export function getTimesheetDateRange(
  preset: DateRangePreset,
  now: Date = new Date(),
  zone: string = detectTimezone(),
): DateRange {
  const [fromKey, toKey] = keysFor(preset, dateKeyInZone(now, zone));
  return {
    from: startOfDayInZone(fromKey, zone),
    // Inclusive: the last millisecond of the day, not the next day's
    // midnight. The backend filters with `Between`, which includes both
    // ends, so an exclusive end would pull in an entry starting exactly at
    // midnight the following day.
    to: new Date(endOfDayInZone(toKey, zone).getTime() - 1),
  };
}
