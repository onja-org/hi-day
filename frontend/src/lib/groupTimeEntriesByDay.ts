import { entrySeconds } from "./entrySeconds";
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

/**
 * "Today" for the current day, and the real dated label for every other —
 * "Mon, Sep 28, 2026", carrying the year so an exported or screenshotted
 * timesheet stays unambiguous. "Yesterday" and friends are deliberately not
 * used: only the current day is unmistakable without knowing today's date.
 */
function labelFor(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) {
    return "Today";
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Groups a timesheet's entries by local calendar day, in the order they
 * first appear (the API already returns them most-recent-first, so this
 * preserves that).
 *
 * `elapsedNow` is deliberately not defaulted to the current time: it's the
 * clock reading a still-running entry's accrued time is measured against,
 * and there isn't one during server rendering — passing it in keeps day
 * totals identical on both sides of hydration. Omit it and running entries
 * contribute nothing, which is what a total of already-banked time means.
 */
export function groupTimeEntriesByDay(
  entries: TimeEntryListItem[],
  elapsedNow: Date | null = null,
): TimeEntryDayGroup[] {
  const groups: TimeEntryDayGroup[] = [];
  const groupsByKey = new Map<string, TimeEntryDayGroup>();
  // Safe to read the clock here despite this running during render: the
  // table and tiles only call this once entries have loaded, which is always
  // client-side, so there is no server-rendered label to disagree with.
  const todayKey = toDateKey(new Date().toISOString());

  for (const entry of entries) {
    const dateKey = toDateKey(entry.startedAt);
    let group = groupsByKey.get(dateKey);
    if (!group) {
      group = { dateKey, label: labelFor(dateKey, todayKey), entries: [], totalSeconds: 0 };
      groupsByKey.set(dateKey, group);
      groups.push(group);
    }
    group.entries.push(entry);
    group.totalSeconds += entrySeconds(entry, elapsedNow);
  }

  return groups;
}
