import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pauseTimeEntry } from "@/lib/pauseTimeEntry";
import { resumeTimeEntry } from "@/lib/resumeTimeEntry";
import { startTimeEntry } from "@/lib/startTimeEntry";
import { webTimerConstraint } from "@/lib/webTimerConstraint";
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
  const [localNowMs, setLocalNowMs] = useState(() => Date.now());

  // The web's own timer only — a device's is never displayed here. It does
  // constrain what can be started, though: see `webTimerConstraint`.
  const entry = currentQuery.data?.entry ?? null;
  const { requiredProjectId } = webTimerConstraint(
    currentQuery.data?.elsewhere ?? null,
  );
  const effectiveProjectId = requiredProjectId ?? projectId;
  const activeProject = entry
    ? (projectsQuery.data?.find(
        (project) => project.id === entry.projectId,
      ) ?? null)
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
    mutationFn: () =>
      startTimeEntry(organisationId, effectiveProjectId, taskId || null),
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
    mutationFn: () =>
      switchTimeEntry(organisationId, effectiveProjectId, taskId || null),
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

  // Ticks once a second so the clocks move between polls.
  useEffect(() => {
    if (!entry || isPaused) return;

    const interval = setInterval(() => setLocalNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [entry, isPaused]);

  /**
   * Two figures, deliberately separate. `elapsedMs` is *this session* — zero
   * with nothing running — and `workedTodayMs` is the day's total beside it.
   * One number serving both meant the timer could never read 00:00:00.
   *
   * Both tick from the local clock corrected against the server's reading,
   * so a skewed machine cannot drift either.
   */
  const serverNow = currentQuery.data?.now;
  const serverOffsetMs =
    serverNow && currentQuery.dataUpdatedAt
      ? new Date(serverNow).getTime() - currentQuery.dataUpdatedAt
      : 0;
  const correctedNowMs = localNowMs + serverOffsetMs;

  const elapsedMs = entry
    ? Math.max(
        0,
        (entry.pausedAt
          ? new Date(entry.pausedAt).getTime()
          : correctedNowMs) -
          new Date(entry.startedAt).getTime() -
          entry.pausedSeconds * 1000,
      )
    : 0;

  const workedTodayMs =
    (dashboardQuery.data?.workedTodaySeconds ?? 0) * 1000 +
    (entry && !isPaused && dashboardQuery.dataUpdatedAt
      ? Math.max(0, localNowMs - dashboardQuery.dataUpdatedAt)
      : 0);

  return {
    isLoading: currentQuery.isLoading || projectsQuery.isLoading,
    isError: currentQuery.isError || projectsQuery.isError || !projectsQuery.data,
    entry: entry,
    activeProject,
    /** The displayed timer belongs to a device, so it can be watched but not
     * stopped, paused or resumed from here. */
    /** This session only — 0 when nothing is running. */
    elapsedMs,
    /** Everything worked today, across every project and device. */
    workedTodayMs,
    isPaused,
    projects: projectsQuery.data ?? [],
    /** Non-null while a device is tracking: the only Project the web may
     * start. The picker greys out the rest rather than hiding them, so a
     * shrunken list never reads as projects having gone missing. */
    requiredProjectId,
    projectId: effectiveProjectId,
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
