"use client";

import type { RunningTimer } from "@/hooks/useRunningTimer";
import { formatElapsed } from "@/lib/formatElapsed";

type HeaderTimerStoppedSummaryProps = {
  timer: RunningTimer;
};

// What the header pill's panel shows above the picker while nothing runs, so
// the web timer's time stays visible after a stop, as it is while tracking.
export function HeaderTimerStoppedSummary({ timer }: HeaderTimerStoppedSummaryProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-center font-data text-3xl font-bold tracking-tight tabular-nums text-primary-dark">
        {formatElapsed(timer.elapsedMs)}
      </p>
      <p className="text-center text-xs text-slate-900/60">
        Today: {formatElapsed(timer.workedTodayMs)}
      </p>
    </div>
  );
}
