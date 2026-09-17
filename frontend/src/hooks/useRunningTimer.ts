import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pauseTimeEntry } from "@/lib/pauseTimeEntry";
import { resumeTimeEntry } from "@/lib/resumeTimeEntry";
import { startTimeEntry } from "@/lib/startTimeEntry";
import { stopTimeEntry } from "@/lib/stopTimeEntry";
import { switchTimeEntry } from "@/lib/switchTimeEntry";
import { CURRENT_TIME_ENTRY_QUERY_KEY, useCurrentTimeEntry } from "./useCurrentTimeEntry";
import { DASHBOARD_SUMMARY_QUERY_KEY, useDashboardSummary } from "./useDashboardSummary";
import { useMyProjects } from "./useMyProjects";
import { TIME_ENTRIES_QUERY_KEY_PREFIX } from "./useTimeEntries";

/**
 * All the state and actions a timer control needs — shared by the
 * dashboard's full `RunningTimerWidget` and the header's compact
 * `HeaderTimerWidget` so the two never disagree about what's running (both
 * read/write the same react-query cache) and the start/stop/switch logic
 * exists exactly once.
 */
export function useRunningTimer(organisationId: string) {
  const queryClient = useQueryClient();
  const currentQuery = useCurrentTimeEntry(organisationId);
  const projectsQuery = useMyProjects(organisationId);
  const dashboardQuery = useDashboardSummary(organisationId);

  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const entry = currentQuery.data?.entry ?? null;
  const serverNow = currentQuery.data?.now;
  const activeProject = entry
    ? (projectsQuery.data?.find((project) => project.id === entry.projectId) ?? null)
    : null;

  // Today's *completed* seconds per project (see DashboardSummary.projectsToday)
  // — the baseline a project "resumes from" when its timer is started/
  // restarted, so switching projects (or platforms, or logging back in)
  // never shows a bare 0 for time already tracked today.
  const projectSecondsToday = useMemo(
    () => new Map(dashboardQuery.data?.projectsToday.map((p) => [p.projectId, p.seconds])),
    [dashboardQuery.data],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: CURRENT_TIME_ENTRY_QUERY_KEY(organisationId),
    });
    // The Timesheets page's list is stale the moment a timer stops (a new
    // completed entry exists) or starts (a running one now belongs there
    // too) — invalidate it here rather than relying on the user to reload
    // that page after the fact. The bare prefix (no membership/date
    // segments) matches every timesheet query for this org — whichever
    // date filter or member is currently being viewed — since react-query
    // invalidates by key prefix.
    void queryClient.invalidateQueries({
      queryKey: TIME_ENTRIES_QUERY_KEY_PREFIX(organisationId),
    });
    // Starting/stopping/switching changes both "worked today" and
    // projectsToday's completed-entries baseline (see above) — without
    // this, the dashboard KPI and the picker's "already tracked" figure
    // would only catch up on the next unrelated remount/window-focus.
    void queryClient.invalidateQueries({
      queryKey: DASHBOARD_SUMMARY_QUERY_KEY(organisationId),
    });
  };

  const startMutation = useMutation({
    mutationFn: () => startTimeEntry(organisationId, projectId, taskId || null),
    onSuccess: (result) => {
      if (result.ok) {
        setConflictMessage(null);
        invalidate();
      } else {
        setConflictMessage(result.runningEntry ? result.message : null);
      }
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => stopTimeEntry(organisationId),
    onSuccess: invalidate,
  });

  const switchMutation = useMutation({
    mutationFn: () => switchTimeEntry(organisationId, projectId, taskId || null),
    onSuccess: (result) => {
      if (result.ok) {
        setConflictMessage(null);
        invalidate();
      }
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseTimeEntry(organisationId),
    onSuccess: invalidate,
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeTimeEntry(organisationId),
    onSuccess: invalidate,
  });

  const isPaused = entry?.pausedAt != null;

  // While paused, elapsed time is fully derived from the entry itself (no
  // ticking) — computed directly during render rather than via state, since
  // an effect must never call setState synchronously with a value that's
  // already derivable from its own inputs.
  const frozenElapsedMs =
    entry && entry.pausedAt
      ? new Date(entry.pausedAt).getTime() -
        new Date(entry.startedAt).getTime() -
        entry.pausedSeconds * 1000
      : null;

  // Ticks the elapsed-time display once a second while a timer is actually
  // running (not paused). The offset between the server's clock (from the
  // last poll) and this device's own clock is recomputed each time
  // `serverNow` changes, so a skewed local clock never desyncs the
  // displayed elapsed time.
  useEffect(() => {
    if (!entry || !serverNow || entry.pausedAt) return;
    const startedAtMs = new Date(entry.startedAt).getTime();
    const pausedMs = entry.pausedSeconds * 1000;
    const serverOffsetMs = new Date(serverNow).getTime() - Date.now();
    const interval = setInterval(
      () => setElapsedMs(Date.now() + serverOffsetMs - startedAtMs - pausedMs),
      1000,
    );
    return () => clearInterval(interval);
  }, [entry, serverNow]);

  // The baseline this project already has today (completed entries only,
  // see projectSecondsToday above) plus however much of the *current*
  // entry has ticked — never just the current entry alone, or restarting a
  // project the same day would visibly reset to 0.
  const todaySecondsBeforeThisEntry = entry
    ? projectSecondsToday.get(entry.projectId) ?? 0
    : 0;

  return {
    isLoading: currentQuery.isLoading || projectsQuery.isLoading,
    isError: currentQuery.isError || projectsQuery.isError || !projectsQuery.data,
    entry,
    activeProject,
    elapsedMs: todaySecondsBeforeThisEntry * 1000 + (frozenElapsedMs ?? elapsedMs),
    isPaused,
    projects: projectsQuery.data ?? [],
    projectId,
    taskId,
    // For the picker: how much of *this* (not-yet-started) project is
    // already tracked today, so choosing a project previews its running
    // total before the person even presses Start.
    projectSecondsToday,
    conflictMessage,
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    isSwitching: switchMutation.isPending,
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    onProjectChange: (id: string) => {
      setProjectId(id);
      setTaskId("");
    },
    onTaskChange: setTaskId,
    onStart: () => startMutation.mutate(),
    onStop: () => stopMutation.mutate(),
    onSwitch: () => switchMutation.mutate(),
    onPause: () => pauseMutation.mutate(),
    onResume: () => resumeMutation.mutate(),
  };
}

export type RunningTimer = ReturnType<typeof useRunningTimer>;
