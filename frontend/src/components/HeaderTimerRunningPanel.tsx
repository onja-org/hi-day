"use client";

import { PauseIcon, PlayIcon, StopIcon } from "@phosphor-icons/react";
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
      <p className="text-center text-3xl font-semibold tabular-nums text-primary-dark">
        {formatElapsed(timer.elapsedMs)}
      </p>
      {timer.isPaused && (
        <p className="text-center text-xs text-secondary">Paused</p>
      )}
      <div className="flex items-center gap-2">
        {timer.isPaused ? (
          <button
            type="button"
            onClick={timer.onResume}
            disabled={timer.isResuming}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlayIcon size={18} weight="fill" aria-hidden="true" />
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={timer.onPause}
            disabled={timer.isPausing}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-primary-dark/20 px-4 py-2 text-primary-dark transition-colors duration-150 hover:bg-primary-dark/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PauseIcon size={18} weight="fill" aria-hidden="true" />
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={timer.onStop}
          disabled={timer.isStopping}
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary-dark px-4 py-2 text-white transition-colors duration-150 hover:bg-primary-dark/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <StopIcon size={18} weight="fill" aria-hidden="true" />
          Stop
        </button>
      </div>
    </div>
  );
}
