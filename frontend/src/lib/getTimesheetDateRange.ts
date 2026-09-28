import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import type { DateRange, DateRangePreset } from "@/types/dateRange";

// Monday-start, matching the date picker's calendar grid and `getWeekRange`.
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

/**
 * Resolves a preset into a `{from, to}` instant range in the *viewer's*
 * local timezone (not UTC) — "today" means the caller's own calendar day,
 * matching how a person entering/reviewing hours actually thinks about
 * dates. "Last week"/"last 2 weeks"/"last month" are whole calendar
 * periods before the current one; the others run up to the end of today.
 */
export function getTimesheetDateRange(
  preset: DateRangePreset,
  now: Date = new Date(),
): DateRange {
  const todayEnd = endOfDay(now);

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: todayEnd };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case "last_7_days":
      return { from: startOfDay(subDays(now, 6)), to: todayEnd };
    case "last_week": {
      const lastWeek = subWeeks(now, 1);
      return {
        from: startOfWeek(lastWeek, WEEK_OPTIONS),
        to: endOfWeek(lastWeek, WEEK_OPTIONS),
      };
    }
    case "last_2_weeks":
      return {
        from: startOfWeek(subWeeks(now, 2), WEEK_OPTIONS),
        to: endOfWeek(subWeeks(now, 1), WEEK_OPTIONS),
      };
    case "this_month":
      return { from: startOfMonth(now), to: todayEnd };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
  }
}
