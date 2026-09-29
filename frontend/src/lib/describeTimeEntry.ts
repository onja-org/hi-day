import { formatClockTime } from "./formatClockTime";
import { formatElapsed } from "./formatElapsed";
import type { TimeEntryListItem } from "@/types/timeEntry";

/**
 * A one-line identification of an entry — project, day, the exact span, and
 * its duration. Used wherever an entry has to be named away from its own row
 * (a delete confirmation, most of all), since the span is what distinguishes
 * two same-day entries on the same project — exactly the case where
 * deleting the wrong one is easiest.
 */
export function describeTimeEntry(entry: TimeEntryListItem): string {
  const day = new Date(entry.startedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  const span = entry.endedAt
    ? `${formatClockTime(entry.startedAt)} – ${formatClockTime(entry.endedAt)}`
    : `${formatClockTime(entry.startedAt)} – not stopped yet`;
  const duration =
    entry.durationSeconds === null
      ? ""
      : ` (${formatElapsed(entry.durationSeconds * 1000)})`;
  return `${entry.projectName} · ${day} · ${span}${duration}`;
}
