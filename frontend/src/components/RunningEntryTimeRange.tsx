"use client";

import { HALF_HOUR_MS, useNow } from "@/hooks/useNow";
import { formatTimeInZone } from "@/lib/timezone";

type RunningEntryTimeRangeProps = {
  startedAt: string;
  zone: string;
};

/**
 * The time range of an entry that hasn't stopped yet, closing on the
 * current clock time rather than the word "now" and moving on every half
 * hour.
 *
 * Its own component so the interval exists only while such an entry is on
 * screen — at most one per person, since the database allows a single
 * running entry per Membership — instead of every row holding a timer it
 * would never use.
 */
export function RunningEntryTimeRange({
  startedAt,
  zone,
}: RunningEntryTimeRangeProps) {
  const now = useNow(HALF_HOUR_MS);
  const start = formatTimeInZone(startedAt, zone);

  // First paint (and the server's) has no clock reading — see `useNow`.
  // Showing the start alone beats a placeholder that shifts the row's width
  // a moment later.
  if (!now) {
    return <>{start}</>;
  }

  return <>{`${start} – ${formatTimeInZone(now, zone)}`}</>;
}
