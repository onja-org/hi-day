import type { DateRange } from "@/types/dateRange";
import { endOfDayInZone, startOfDayInZone } from "./timezone";

/**
 * A hand-picked pair of calendar days resolved into instants in `zone` —
 * what `getTimesheetDateRange` does for a preset. Days are stored rather
 * than instants so the range re-resolves when the viewing zone changes.
 */
export function getCustomDateRange(
  fromKey: string,
  toKey: string,
  zone: string,
): DateRange {
  return {
    from: startOfDayInZone(fromKey, zone),
    // Inclusive, matching getTimesheetDateRange.
    to: new Date(endOfDayInZone(toKey, zone).getTime() - 1),
  };
}
