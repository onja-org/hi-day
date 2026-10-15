import { formatElapsed } from "@/lib/formatElapsed";
import type { TimeEntryListItem } from "@/types/timeEntry";
import { entryProjectName } from "@/lib/entryProjectDisplay";

/** Shared so the CSV and the PDF can't drift apart. The CSV appends a
 * "Time zone" column; the PDF names the zone once in its title instead. */
export const TIMESHEET_EXPORT_HEADER = [
  "Date",
  "Project",
  "Task",
  "Start",
  "End",
  "Duration",
  "Paused (min)",
  "Source",
];

function formatDateTime(iso: string | null, zone: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], { timeZone: zone });
}

/** One row per entry, every time read in `zone` so an export matches the
 * screen it came from. */
export function timesheetExportRows(
  entries: TimeEntryListItem[],
  zone: string,
): string[][] {
  return entries.map((entry) => [
    new Date(entry.startedAt).toLocaleDateString([], { timeZone: zone }),
    entryProjectName(entry),
    entry.taskName ?? "",
    formatDateTime(entry.startedAt, zone),
    entry.endedAt ? formatDateTime(entry.endedAt, zone) : "In progress",
    entry.durationSeconds === null
      ? ""
      : formatElapsed(entry.durationSeconds * 1000),
    String(Math.round(entry.pausedSeconds / 60)),
    entry.source,
  ]);
}
