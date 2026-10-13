import type { DateRange, DateRangePreset } from "@/types/dateRange";
import type { WeekStart } from "@/types/organisation";
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

/** The calendar days a preset covers. Zone-free — a preset names days. */
function keysFor(
  preset: DateRangePreset,
  todayKey: string,
  weekStart: WeekStart,
): [string, string] {
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
      return [
        startOfWeekKey(inLastWeek, weekStart),
        endOfWeekKey(inLastWeek, weekStart),
      ];
    }
    case "last_2_weeks":
      return [
        startOfWeekKey(addDaysToKey(todayKey, -14), weekStart),
        endOfWeekKey(addDaysToKey(todayKey, -7), weekStart),
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
 * Resolves a preset into a `{from, to}` instant range, its calendar days
 * read in `zone` (the viewer's by default).
 *
 * The arithmetic runs on date keys and becomes instants only at the end,
 * which is what respects a day the clocks change being 23 or 25 hours.
 */
export function getTimesheetDateRange(
  preset: DateRangePreset,
  now: Date = new Date(),
  zone: string = detectTimezone(),
  weekStart: WeekStart = "monday",
): DateRange {
  const [fromKey, toKey] = keysFor(preset, dateKeyInZone(now, zone), weekStart);
  return {
    from: startOfDayInZone(fromKey, zone),
    // Inclusive: the backend filters with `Between`, so the next day's
    // midnight would pull in that day's first entry.
    to: new Date(endOfDayInZone(toKey, zone).getTime() - 1),
  };
}
