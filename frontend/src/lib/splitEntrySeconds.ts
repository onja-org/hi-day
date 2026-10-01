import { entrySeconds } from "@/lib/entrySeconds";
import type { TimeEntryListItem } from "@/types/timeEntry";

/** An entry list's seconds split into manually added time and everything else (timer / desktop agent). */
export function splitEntrySeconds(entries: TimeEntryListItem[]): {
  tracked: number;
  manual: number;
} {
  let tracked = 0;
  let manual = 0;
  for (const entry of entries) {
    const seconds = entrySeconds(entry, null);
    if (entry.source === "manual") manual += seconds;
    else tracked += seconds;
  }
  return { tracked, manual };
}
