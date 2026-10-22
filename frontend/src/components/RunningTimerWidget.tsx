"use client";

import { StopIcon } from "@phosphor-icons/react";
import { useRunningTimer } from "@/hooks/useRunningTimer";
import { formatElapsed } from "@/lib/formatElapsed";
import { ErrorMessage } from "./ErrorMessage";
import { InfoMessage } from "./InfoMessage";
import { WorkTimeLimitReachedModal } from "./WorkTimeLimitReachedModal";
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
      {timer.limitReached && (
        <WorkTimeLimitReachedModal
          kind={timer.limitReached.kind}
          limitHours={timer.limitReached.limitHours}
          onClose={timer.dismissLimitReached}
        />
      )}
      {timer.entry?.projectId && !timer.projectsEnabled && (
        <div className="mb-4">
          <InfoMessage message="Projects are now turned off. Your timer keeps running on its project until you stop it." />
        </div>
      )}
      {timer.entry ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
            </span>
            <div className="flex flex-col">
              <span className="flex items-center gap-2 font-medium text-primary-dark">
                {timer.activeProject && (
                  <ProjectColourBadge colour={timer.activeProject.colour} />
                )}
                {timer.activeProject?.name ?? "Tracking time"}
              </span>
              <span className="font-data text-3xl font-bold tracking-tight tabular-nums text-primary-dark">
                {formatElapsed(timer.elapsedMs)}
              </span>
              <span className="text-xs text-slate-900/60">
                Today: {formatElapsed(timer.workedTodayMs)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={timer.onStop}
              disabled={timer.isStopping}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-brand-sm border-2 border-ink bg-primary-dark px-5 h-11 text-white transition-colors duration-150 hover:bg-primary-dark/90 disabled:cursor-not-allowed disabled:opacity-50 font-bold"
            >
              <StopIcon size={18} weight="fill" aria-hidden="true" />
              Stop
            </button>
          </div>
        </div>
      ) : (
        <TimerPicker
          organisationId={organisationId}
          projectsEnabled={timer.projectsEnabled}
          projects={timer.projects}
          projectId={timer.projectId}
          taskId={timer.taskId}
          projectSecondsToday={timer.projectSecondsToday}
          conflictMessage={timer.conflictMessage}
          canSwitch={timer.canSwitch}
          trackingNotice={timer.trackingNotice}
          requiredProjectId={timer.requiredProjectId}
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
