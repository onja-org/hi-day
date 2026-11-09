import { formatElapsed } from "./formatElapsed";
import type { TimeEntryListItem } from "@/types/timeEntry";

/**
 * Kept idle time as a duration with its share of the entry beside it, or
 * null when none was folded in. Both readings, because neither carries
 * alone: 50% of a four-minute entry is two minutes, where 20% of a six-hour
 * one is seventy-two. The share is derived rather than stored so it cannot
 * drift from the duration.
 */
export function idleShareLabel(entry: TimeEntryListItem): string | null {
  const idleSeconds = entry.idleSeconds;
  if (idleSeconds === null || idleSeconds === undefined || idleSeconds <= 0) {
    return null;
  }

  const idle = `Idle ${formatElapsed(idleSeconds * 1000)}`;
  // A running entry has no duration yet, so there is no share to take.
  const total = entry.durationSeconds;
  if (total === null || total <= 0) return idle;

  return `${idle} (${Math.round((idleSeconds / total) * 100)}%)`;
}
