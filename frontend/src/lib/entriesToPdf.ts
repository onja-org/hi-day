import { describeTimezone, detectTimezone } from "@/lib/timezone";
import {
  TIMESHEET_EXPORT_HEADER,
  timesheetExportRows,
} from "@/lib/timesheetExportRows";
import { toPdfBlob } from "@/lib/toPdfBlob";
import type { TimeEntryListItem } from "@/types/timeEntry";

/**
 * mm — Project and Task hold free text that can be one long unbroken word,
 * which left on autoTable's "auto" width would squeeze every other column
 * to a sliver. See `toPdfBlob`.
 */
const WIDE_COLUMN_WIDTHS = { 1: 34, 2: 34 };

/**
 * The same rows as the CSV, with the zone named once in the title rather
 * than repeated down a column — appended here rather than left to callers
 * so a PDF can't be produced that doesn't say which clock it is on.
 */
export function entriesToPdf(
  title: string,
  entries: TimeEntryListItem[],
  zone: string = detectTimezone(),
): Blob {
  return toPdfBlob(
    `${title} — times in ${describeTimezone(zone)}`,
    TIMESHEET_EXPORT_HEADER,
    timesheetExportRows(entries, zone),
    WIDE_COLUMN_WIDTHS,
  );
}
