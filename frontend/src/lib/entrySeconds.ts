import { runningEntrySeconds } from "./runningEntrySeconds";
import type { TimeEntryListItem } from "@/types/timeEntry";

/**
 * What an entry contributes to a total, stopped or not. A completed one
 * gives its settled `durationSeconds`; a running one gives what it has
 * accrued so far, so a day's total reflects time being tracked right now
 * and not only time already banked.
 *
 * Contributes nothing when there is no clock reading yet to measure an
 * unpaused running entry against — see `runningEntrySeconds`.
 */
export function entrySeconds(
  entry: TimeEntryListItem,
  now: Date | null,
): number {
  return entry.durationSeconds ?? runningEntrySeconds(entry, now) ?? 0;
}
