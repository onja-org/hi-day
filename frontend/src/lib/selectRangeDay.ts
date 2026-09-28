import { isBefore, startOfDay } from "date-fns";
import type { RangeSelection } from "@/types/dateRange";

/**
 * Applies one calendar-day click to the picker's draft selection: the
 * first click starts a new single-day range, the second closes it —
 * swapping ends if the second day is earlier than the first, so clicking
 * "backwards" still produces a valid from ≤ to range.
 */
export function selectRangeDay(selection: RangeSelection, day: Date): RangeSelection {
  const clicked = startOfDay(day);

  if (!selection.pickingEnd) {
    return { from: clicked, to: clicked, pickingEnd: true };
  }

  if (isBefore(clicked, selection.from)) {
    return { from: clicked, to: selection.from, pickingEnd: false };
  }
  return { from: selection.from, to: clicked, pickingEnd: false };
}
