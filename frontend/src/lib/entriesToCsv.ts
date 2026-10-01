import { formatElapsed } from "@/lib/formatElapsed";
import { detectTimezone } from "@/lib/timezone";
import { toCsvString } from "@/lib/toCsvString";
import type { TimeEntryListItem } from "@/types/timeEntry";

const HEADER = [
  "Date",
  "Project",
  "Task",
  "Start",
  "End",
  "Duration",
  "Paused (min)",
  "Source",
  // Named in the file: the same entry reads as a different time, sometimes
  // a different day, depending on where it is read.
  "Time zone",
];

function formatDateTime(iso: string | null, zone: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], { timeZone: zone });
}

/** Exported in the zone the page was read in, so file and screen agree. */
export function entriesToCsv(
  entries: TimeEntryListItem[],
  zone: string = detectTimezone(),
): string {
  const rows = entries.map((entry) => [
    new Date(entry.startedAt).toLocaleDateString([], { timeZone: zone }),
    entry.projectName,
    entry.taskName ?? "",
    formatDateTime(entry.startedAt, zone),
    entry.endedAt ? formatDateTime(entry.endedAt, zone) : "In progress",
    entry.durationSeconds === null ? "" : formatElapsed(entry.durationSeconds * 1000),
    String(Math.round(entry.pausedSeconds / 60)),
    entry.source,
    zone,
  ]);

  return toCsvString(HEADER, rows);
}
