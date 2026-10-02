import { unionActiveSeconds } from "@/lib/unionActiveSeconds";
import { dateKeyInZone, detectTimezone } from "./timezone";
import type { TimeEntryListItem } from "@/types/timeEntry";

export type TimeEntryDayGroup = {
  dateKey: string;
  label: string;
  entries: TimeEntryListItem[];
  totalSeconds: number;
};

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
  // From the key's own numbers, not by parsing it as an instant, so the
  // label can't drift a day from the group it heads.
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
 * `zone` decides which day each entry falls on and what counts as "Today",
 * defaulting to the viewer's own.
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
  zone: string = detectTimezone(),
): TimeEntryDayGroup[] {
  const groups: TimeEntryDayGroup[] = [];
  const groupsByKey = new Map<string, TimeEntryDayGroup>();
  // Safe to read the clock here despite this running during render: the
  // table and tiles only call this once entries have loaded, which is always
  // client-side, so there is no server-rendered label to disagree with.
  const todayKey = dateKeyInZone(new Date(), zone);

  for (const entry of entries) {
    const dateKey = dateKeyInZone(entry.startedAt, zone);
    let group = groupsByKey.get(dateKey);
    if (!group) {
      group = { dateKey, label: labelFor(dateKey, todayKey), entries: [], totalSeconds: 0 };
      groupsByKey.set(dateKey, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }

  // Unioned, not summed: a person may have been tracking on two Devices at
  // once, and time they share counts once (ADR-0022). `elapsedNow` is passed
  // through so a still-running entry still contributes what it has accrued.
  for (const group of groups) {
    group.totalSeconds = unionActiveSeconds(group.entries, elapsedNow);
  }

  return groups;
}
