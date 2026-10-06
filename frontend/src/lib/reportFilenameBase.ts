import { format } from "date-fns";
import type { DateRange } from "@/types/dateRange";

/** A report's file name without its extension: "<slug>-2026-10-05-to-2026-10-11". */
export function reportFilenameBase(slug: string, range: DateRange): string {
  return `${slug}-${format(range.from, "yyyy-MM-dd")}-to-${format(range.to, "yyyy-MM-dd")}`;
}
