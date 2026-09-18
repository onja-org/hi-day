import { formatElapsed } from "@/lib/formatElapsed";
import { toCsvString } from "@/lib/toCsvString";
import type { TimeEntryListItem } from "@/types/timeEntry";

const HEADER = ["Date", "Project", "Task", "Start", "End", "Duration", "Paused (min)", "Source"];

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

export function entriesToCsv(entries: TimeEntryListItem[]): string {
  const rows = entries.map((entry) => [
    new Date(entry.startedAt).toLocaleDateString(),
    entry.projectName,
    entry.taskName ?? "",
    formatDateTime(entry.startedAt),
    entry.endedAt ? formatDateTime(entry.endedAt) : "In progress",
    entry.durationSeconds === null ? "" : formatElapsed(entry.durationSeconds * 1000),
    String(Math.round(entry.pausedSeconds / 60)),
    entry.source,
  ]);

  return toCsvString(HEADER, rows);
}
