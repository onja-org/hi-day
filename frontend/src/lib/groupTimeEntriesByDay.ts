import { unionActiveSeconds } from "@/lib/unionActiveSeconds";
import type { TimeEntryListItem } from "@/types/timeEntry";

export type TimeEntryDayGroup = {
  dateKey: string;
  label: string;
  entries: TimeEntryListItem[];
  totalSeconds: number;
};

function toDateKey(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function labelFor(dateKey: string, today: Date): string {
  const todayKey = toDateKey(today.toISOString());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday.toISOString());

  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";

  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Groups a timesheet's entries by local calendar day, in the order they
 * first appear (the API already returns them most-recent-first, so this
 * preserves that). Each group's `totalSeconds` only sums completed entries
 * — a still-running one has no fixed duration to add.
 */
export function groupTimeEntriesByDay(
  entries: TimeEntryListItem[],
  now: Date = new Date(),
): TimeEntryDayGroup[] {
  const groups: TimeEntryDayGroup[] = [];
  const groupsByKey = new Map<string, TimeEntryDayGroup>();

  for (const entry of entries) {
    const dateKey = toDateKey(entry.startedAt);
    let group = groupsByKey.get(dateKey);
    if (!group) {
      group = { dateKey, label: labelFor(dateKey, now), entries: [], totalSeconds: 0 };
      groupsByKey.set(dateKey, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }

  // Unioned, not summed: a person may have been tracking on two Devices at
  // once, and time they share counts once (ADR-0021).
  for (const group of groups) {
    group.totalSeconds = unionActiveSeconds(group.entries);
  }

  return groups;
}
