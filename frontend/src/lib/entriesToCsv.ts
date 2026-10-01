import { detectTimezone } from "@/lib/timezone";
import {
  TIMESHEET_EXPORT_HEADER,
  timesheetExportRows,
} from "@/lib/timesheetExportRows";
import { toCsvString } from "@/lib/toCsvString";
import type { TimeEntryListItem } from "@/types/timeEntry";

// Named in the file: the same entry reads as a different time, sometimes a
// different day, depending on where it is read.
const HEADER = [...TIMESHEET_EXPORT_HEADER, "Time zone"];

/** Exported in the zone the page was read in, so file and screen agree. */
export function entriesToCsv(
  entries: TimeEntryListItem[],
  zone: string = detectTimezone(),
): string {
  const rows = timesheetExportRows(entries, zone).map((row) => [...row, zone]);

  return toCsvString(HEADER, rows);
}
