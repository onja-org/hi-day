"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDownIcon, PlayIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useRunningTimer } from "@/hooks/useRunningTimer";
import { formatElapsed } from "@/lib/formatElapsed";
import { HeaderTimerRunningPanel } from "./HeaderTimerRunningPanel";
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
          "flex cursor-pointer items-center gap-2 rounded-brand-sm border-2 border-ink px-3 py-1.5 text-sm font-semibold transition-colors duration-150",
          timer.entry && "bg-primary text-white hover:bg-primary/90",
          !timer.entry && "text-slate-900 hover:bg-cream",
        )}
      >
        {timer.entry ? (
          <>
            <span
              className={clsx(
                "h-2 w-2 rounded-full bg-white",
                !timer.isPaused && "animate-pulse",
              )}
            />
            <span className="font-data tabular-nums">{formatElapsed(timer.elapsedMs)}</span>
          </>
        ) : (
          <>
            <PlayIcon size={14} weight="fill" aria-hidden="true" />
            <span className="font-data tabular-nums">{formatElapsed(0)}</span>
          </>
        )}
        <CaretDownIcon size={12} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-brand-sm border-2 border-ink bg-white p-4 shadow-hard-sm">
          {timer.entry ? (
            <HeaderTimerRunningPanel timer={timer} />
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
              layout="stacked"
            />
          )}
        </div>
      )}
    </div>
  );
}
