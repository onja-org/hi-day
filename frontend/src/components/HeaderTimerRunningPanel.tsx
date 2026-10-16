"use client";

import { StopIcon } from "@phosphor-icons/react";
import type { RunningTimer } from "@/hooks/useRunningTimer";
import { formatElapsed } from "@/lib/formatElapsed";
import { ProjectColourBadge } from "./ProjectColourBadge";

type HeaderTimerRunningPanelProps = {
  timer: RunningTimer;
};

// The expanded header pill's contents while a timer is running — split out
// of HeaderTimerWidget purely to keep that file under its line-count budget.
export function HeaderTimerRunningPanel({ timer }: HeaderTimerRunningPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {timer.activeProject && (
          <ProjectColourBadge colour={timer.activeProject.colour} />
        )}
        <span className="font-medium text-primary-dark">
          {timer.activeProject?.name ?? "Tracking time"}
        </span>
      </div>
      <p className="text-center font-data text-3xl font-bold tracking-tight tabular-nums text-primary-dark">
        {formatElapsed(timer.elapsedMs)}
      </p>
      <p className="text-center text-xs text-slate-900/60">
        Today: {formatElapsed(timer.workedTodayMs)}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={timer.onStop}
          disabled={timer.isStopping}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-brand-sm border-2 border-ink bg-primary-dark px-4 h-11 text-white transition-colors duration-150 hover:bg-primary-dark/90 disabled:cursor-not-allowed disabled:opacity-50 font-bold"
        >
          <StopIcon size={18} weight="fill" aria-hidden="true" />
          Stop
        </button>
      </div>
    </div>
  );
}
