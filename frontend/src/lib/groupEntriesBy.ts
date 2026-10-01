import { endOfWeek, format, startOfWeek } from "date-fns";
import { fromDateKey } from "@/lib/buildDailyTotals";
import { formatClockTime } from "@/lib/formatClockTime";
import { formatReportDay } from "@/lib/formatReportDay";
import type { TimeActivityGrouping } from "@/types/timeActivityGrouping";
import type { TimeEntryListItem } from "@/types/timeEntry";

export type EntryGroup = {
  id: string;
  label: string;
  /** Orders groups: a timestamp for date groupings, the label otherwise. */
  sortKey: string | number;
  entries: TimeEntryListItem[];
};

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

function dateKeyOf(entry: TimeEntryListItem): string {
  return format(new Date(entry.startedAt), "yyyy-MM-dd");
}

/** "Mon, Sep 28, 2026 · 9:00 AM – 10:00 AM" — a single entry, dated and timed. */
export function describeEntryWhen(entry: TimeEntryListItem): string {
  const end = entry.endedAt ? formatClockTime(entry.endedAt) : "now";
  return `${formatReportDay(dateKeyOf(entry))} · ${formatClockTime(entry.startedAt)} – ${end}`;
}

export function memberLabelOf(entry: TimeEntryListItem): string {
  return entry.memberName ?? entry.memberEmail ?? "-";
}

function describeGroup(entry: TimeEntryListItem, grouping: TimeActivityGrouping): Omit<EntryGroup, "entries"> {
  switch (grouping) {
    case "day": {
      const key = dateKeyOf(entry);
      return { id: key, label: formatReportDay(key), sortKey: fromDateKey(key).getTime() };
    }
    case "week": {
      const start = startOfWeek(new Date(entry.startedAt), WEEK_OPTIONS);
      const end = endOfWeek(start, WEEK_OPTIONS);
      return {
        id: format(start, "yyyy-MM-dd"),
        label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
        sortKey: start.getTime(),
      };
    }
    case "project":
      return { id: entry.projectId, label: entry.projectName, sortKey: entry.projectName };
    case "member": {
      const label = memberLabelOf(entry);
      return { id: entry.membershipId, label, sortKey: label };
    }
    case "todo": {
      const label = entry.taskName ?? "No to-do";
      return { id: entry.taskId ?? "no-task", label, sortKey: label };
    }
    case "none":
      return {
        id: entry.id,
        label: describeEntryWhen(entry),
        sortKey: new Date(entry.startedAt).getTime(),
      };
  }
}

/** Buckets entries by `grouping` (each entry alone for "none"), oldest/alphabetical first. */
export function groupEntriesBy(
  entries: TimeEntryListItem[],
  grouping: TimeActivityGrouping,
): EntryGroup[] {
  const groups = new Map<string, EntryGroup>();
  for (const entry of entries) {
    const described = describeGroup(entry, grouping);
    const existing = groups.get(described.id);
    if (existing) existing.entries.push(entry);
    else groups.set(described.id, { ...described, entries: [entry] });
  }
  return [...groups.values()].sort((a, b) =>
    typeof a.sortKey === "number" && typeof b.sortKey === "number"
      ? a.sortKey - b.sortKey
      : String(a.sortKey).localeCompare(String(b.sortKey)),
  );
}
