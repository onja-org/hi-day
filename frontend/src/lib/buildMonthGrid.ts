import { addDays, startOfMonth, startOfWeek } from "date-fns";

const GRID_DAYS = 6 * 7;

/**
 * The 42 days (six Monday-first weeks) a month calendar shows for `month`
 * — always six rows, padded with the tail of the previous month and the
 * head of the next, so the grid's height never jumps between months.
 */
export function buildMonthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  return Array.from({ length: GRID_DAYS }, (_, index) => addDays(first, index));
}
