import { formatReportDay } from "@/lib/formatReportDay";
import { dateKeyInZone } from "@/lib/timezone";
import type { DateRange } from "@/types/dateRange";

/** "Mon, Oct 19, 2026 - Sun, Oct 25, 2026": the range's days as read in the report's zone. */
export function formatReportRange(range: DateRange, zone: string): string {
  return `${formatReportDay(dateKeyInZone(range.from, zone))} - ${formatReportDay(dateKeyInZone(range.to, zone))}`;
}
