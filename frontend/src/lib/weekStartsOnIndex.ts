import type { WeekStart } from "@/types/organisation";

/** The organisation's week-start day as date-fns' `weekStartsOn`, where 0 is Sunday. */
export function weekStartsOnIndex(weekStart: WeekStart): 0 | 1 {
  return weekStart === "sunday" ? 0 : 1;
}
