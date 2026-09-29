"use client";

import { HALF_HOUR_MS, useNow } from "@/hooks/useNow";
import { formatElapsed } from "@/lib/formatElapsed";
import { runningEntrySeconds } from "@/lib/runningEntrySeconds";
import type { RunningEntryTiming } from "@/lib/runningEntrySeconds";

type RunningEntryDurationProps = {
  entry: RunningEntryTiming;
};

/**
 * How long an unstopped entry has been running, on the same half-hourly
 * clock as its displayed end time — a duration ticking every second beside
 * an end time that moves twice an hour would visibly contradict it.
 */
export function RunningEntryDuration({ entry }: RunningEntryDurationProps) {
  const seconds = runningEntrySeconds(entry, useNow(HALF_HOUR_MS));

  return <>{seconds === null ? "—" : formatElapsed(seconds * 1000)}</>;
}
