import { detectTimezone } from "@/lib/timezone";
import {
  timesheetExportHeader,
  timesheetExportRows,
} from "@/lib/timesheetExportRows";
import { toCsvString } from "@/lib/toCsvString";
import type { TimeEntryListItem } from "@/types/timeEntry";

// The zone is named in the file: the same entry reads as a different time,
// sometimes a different day, depending on where it is read.

/** Exported in the zone the page was read in, so file and screen agree. */
export function entriesToCsv(
  entries: TimeEntryListItem[],
  zone: string = detectTimezone(),
  projectsEnabled = true,
): string {
  const rows = timesheetExportRows(entries, zone, projectsEnabled).map((row) => [...row, zone]);

  return toCsvString([...timesheetExportHeader(projectsEnabled), "Time zone"], rows);
}
