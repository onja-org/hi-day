import { addDays, startOfMonth, startOfWeek } from "date-fns";
import { weekStartsOnIndex } from "@/lib/weekStartsOnIndex";
import type { WeekStart } from "@/types/organisation";

const GRID_DAYS = 6 * 7;

/**
 * The 42 days a month calendar shows for `month`, six weeks starting on the
 * organisation's week-start day — always six rows, padded with the tail of
 * the previous month and the head of the next, so the grid's height never
 * jumps between months.
 */
export function buildMonthGrid(
  month: Date,
  weekStart: WeekStart = "monday",
): Date[] {
  const first = startOfWeek(startOfMonth(month), {
    weekStartsOn: weekStartsOnIndex(weekStart),
  });
  return Array.from({ length: GRID_DAYS }, (_, index) => addDays(first, index));
}
