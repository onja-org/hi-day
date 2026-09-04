"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDownIcon, PlayIcon, StopIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useRunningTimer } from "@/hooks/useRunningTimer";
import { formatElapsed } from "@/lib/formatElapsed";
import { ProjectColourBadge } from "./ProjectColourBadge";
import { Spinner } from "./Spinner";
import { TimerPicker } from "./TimerPicker";

type HeaderTimerWidgetProps = {
  organisationId: string;
};

// The always-visible timer control: a pill in the header (ticking while a
// timer runs, a plain "Start timer" prompt otherwise) that expands into the
// same start/stop/switch panel the dashboard's RunningTimerWidget uses —
// both read/write the same running-timer state via useRunningTimer, so
// starting here and checking the dashboard (or vice versa) never disagree.
export function HeaderTimerWidget({ organisationId }: HeaderTimerWidgetProps) {
  const timer = useRunningTimer(organisationId);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (timer.isLoading) {
    return (
      <span className="flex items-center px-2 text-primary-dark">
        <Spinner />
      </span>
    );
  }

  if (timer.isError) {
    // A full error banner doesn't fit the header — the dashboard's own
    // widgets still surface the failure, so silently omitting the pill
    // here isn't the only place the person would see it.
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={timer.entry ? "Open running timer" : "Open timer"}
        className={clsx(
          "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
          timer.entry
            ? "bg-primary text-white hover:bg-primary/90"
            : "border border-input-border text-slate-900 hover:bg-cream",
        )}
      >
        {timer.entry ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            <span className="tabular-nums">{formatElapsed(timer.elapsedMs)}</span>
          </>
        ) : (
          <>
            <PlayIcon size={14} weight="fill" aria-hidden="true" />
            Start timer
          </>
        )}
        <CaretDownIcon size={12} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border border-primary-dark/20 bg-white p-4 shadow-lg">
          {timer.entry ? (
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
              <button
                type="button"
                onClick={timer.onStop}
                disabled={timer.isStopping}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary-dark px-4 py-2 text-white transition-colors duration-150 hover:bg-primary-dark/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <StopIcon size={18} weight="fill" aria-hidden="true" />
                Stop timer
              </button>
            </div>
          ) : (
            <TimerPicker
              organisationId={organisationId}
              projects={timer.projects}
              projectId={timer.projectId}
              taskId={timer.taskId}
              conflictMessage={timer.conflictMessage}
              isStarting={timer.isStarting}
              isSwitching={timer.isSwitching}
              onProjectChange={timer.onProjectChange}
              onTaskChange={timer.onTaskChange}
              onStart={timer.onStart}
              onSwitch={timer.onSwitch}
              layout="stacked"
            />
          )}
        </div>
      )}
    </div>
  );
}
