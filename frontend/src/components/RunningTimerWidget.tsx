"use client";

import { PauseIcon, PlayIcon, StopIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useRunningTimer } from "@/hooks/useRunningTimer";
import { formatElapsed } from "@/lib/formatElapsed";
import { ErrorMessage } from "./ErrorMessage";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { Spinner } from "./Spinner";
import { TimerPicker } from "./TimerPicker";

type RunningTimerWidgetProps = {
  organisationId: string;
};

export function RunningTimerWidget({ organisationId }: RunningTimerWidgetProps) {
  const timer = useRunningTimer(organisationId);

  if (timer.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (timer.isError) {
    return <ErrorMessage message="Could not load the timer." />;
  }

  return (
    <div className="rounded-lg border border-input-border bg-cream/40 p-4 sm:p-5">
      {timer.entry ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <span
                className={clsx(
                  "h-2.5 w-2.5 rounded-full bg-primary",
                  !timer.isPaused && "animate-pulse",
                )}
              />
            </span>
            <div className="flex flex-col">
              <span className="flex items-center gap-2 font-medium text-primary-dark">
                {timer.activeProject && (
                  <ProjectColourBadge colour={timer.activeProject.colour} />
                )}
                {timer.activeProject?.name ?? "Tracking time"}
                {timer.isPaused && (
                  <span className="text-xs font-normal text-secondary">Paused</span>
                )}
              </span>
              <span className="text-3xl font-semibold tabular-nums text-primary-dark">
                {formatElapsed(timer.elapsedMs)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {timer.isPaused ? (
              <button
                type="button"
                onClick={timer.onResume}
                disabled={timer.isResuming}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayIcon size={18} weight="fill" aria-hidden="true" />
                Resume
              </button>
            ) : (
              <button
                type="button"
                onClick={timer.onPause}
                disabled={timer.isPausing}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-primary-dark/20 px-4 py-2.5 text-primary-dark transition-colors duration-150 hover:bg-primary-dark/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PauseIcon size={18} weight="fill" aria-hidden="true" />
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={timer.onStop}
              disabled={timer.isStopping}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary-dark px-5 py-2.5 text-white transition-colors duration-150 hover:bg-primary-dark/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <StopIcon size={18} weight="fill" aria-hidden="true" />
              Stop
            </button>
          </div>
        </div>
      ) : (
        <TimerPicker
          organisationId={organisationId}
          projects={timer.projects}
          projectId={timer.projectId}
          taskId={timer.taskId}
          projectSecondsToday={timer.projectSecondsToday}
          conflictMessage={timer.conflictMessage}
          isStarting={timer.isStarting}
          isSwitching={timer.isSwitching}
          onProjectChange={timer.onProjectChange}
          onTaskChange={timer.onTaskChange}
          onStart={timer.onStart}
          onSwitch={timer.onSwitch}
        />
      )}
    </div>
  );
}
