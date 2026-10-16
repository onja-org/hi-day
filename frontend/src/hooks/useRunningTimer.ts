import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { allowedAppsNotice } from "@/lib/allowedAppsNotice";
import { unionActiveSeconds } from "@/lib/unionActiveSeconds";
import { startTimeEntry } from "@/lib/startTimeEntry";
import { webTimerConstraint } from "@/lib/webTimerConstraint";
import { stopTimeEntry } from "@/lib/stopTimeEntry";
import { switchTimeEntry } from "@/lib/switchTimeEntry";
import { CURRENT_TIME_ENTRY_QUERY_KEY, useCurrentTimeEntry } from "./useCurrentTimeEntry";
import { DASHBOARD_SUMMARY_QUERY_KEY, useDashboardSummary } from "./useDashboardSummary";
import { useCurrentOrganisation } from "./useCurrentOrganisation";
import { useProjectsEnabled } from "./useProjectsEnabled";
import { useMyProjects } from "./useMyProjects";
import { TIME_ENTRIES_QUERY_KEY_PREFIX, useTimeEntries } from "./useTimeEntries";

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
  const organisationQuery = useCurrentOrganisation();
  const projectsEnabled = useProjectsEnabled();
  const projectsQuery = useMyProjects(organisationId);
  const dashboardQuery = useDashboardSummary(organisationId);

  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  // Switching only ever stops the web's own timer, so it's offered only
  // when that's what's in the way — never a device's, which the web can't
  // stop.
  const [canSwitch, setCanSwitch] = useState(false);
  // Shown instead of offering a Start button the server would refuse.
  const trackingNotice = allowedAppsNotice(
    organisationQuery.data?.allowedApps ?? "all",
  );
  const [localNowMs, setLocalNowMs] = useState(() => Date.now());

  // The web's own timer only — a device's is never displayed here. It does
  // constrain what can be started, though: see `webTimerConstraint`.
  const entry = currentQuery.data?.entry ?? null;
  // Latched: the server reports it on one poll only, and the modal has to
  // outlive that poll. Cleared when the person dismisses it.
  const [limitReached, setLimitReached] = useState<
    { kind: "daily" | "weekly"; limitHours: number } | null
  >(null);
  const reportedLimit = currentQuery.data?.limitReached ?? null;
  if (reportedLimit && !limitReached) setLimitReached(reportedLimit);
  const { requiredProjectId } = webTimerConstraint(
    currentQuery.data?.elsewhere ?? null,
  );
  // With Projects off there is nothing to pick, and the server refuses one.
  const effectiveProjectId = projectsEnabled
    ? (requiredProjectId ?? projectId)
    : "";
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
      startTimeEntry(
        organisationId,
        projectsEnabled ? effectiveProjectId : null,
        taskId || null,
      ),
    onSuccess: (result) => {
      if (result.ok) {
        setConflictMessage(null);
        invalidate();
      } else {
        setConflictMessage(result.runningEntry ? result.message : null);
        setCanSwitch(result.runningEntry?.deviceId === null);
      }
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => stopTimeEntry(organisationId),
    onSuccess: invalidate,
  });

  const switchMutation = useMutation({
    mutationFn: () =>
      switchTimeEntry(
        organisationId,
        projectsEnabled ? effectiveProjectId : null,
        taskId || null,
      ),
    onSuccess: (result) => {
      if (result.ok) {
        setConflictMessage(null);
        invalidate();
      }
    },
  });

  // The web no longer pauses: a break is a stop and a new start. This only
  // covers an entry paused under the old model that is still open, so its
  // clock stays frozen until it is stopped.
  const isPaused = entry?.pausedAt != null;

  // Ticks once a second so the clocks move between polls.
  useEffect(() => {
    if (!entry || isPaused) return;

    const interval = setInterval(() => setLocalNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [entry, isPaused]);

  /**
   * `elapsedMs` is the web timer's own time today — its entries only, so
   * time tracked on a desktop never shows up here — and it carries on from
   * that total when the timer is stopped and started again. Time the web
   * entries share is counted once (`unionActiveSeconds`).
   *
   * Ticks from the local clock corrected against the server's reading, so a
   * skewed machine cannot drift it.
   */
  const serverNow = currentQuery.data?.now;
  const serverOffsetMs =
    serverNow && currentQuery.dataUpdatedAt
      ? new Date(serverNow).getTime() - currentQuery.dataUpdatedAt
      : 0;
  const correctedNowMs = localNowMs + serverOffsetMs;

  const dayKey = new Date(localNowMs).toDateString();
  const todayRange = useMemo(() => {
    const from = new Date(dayKey);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }, [dayKey]);
  const todayEntriesQuery = useTimeEntries(organisationId, todayRange);
  const webEntriesToday = useMemo(
    () =>
      (todayEntriesQuery.data ?? []).filter((item) => item.source === "web"),
    [todayEntriesQuery.data],
  );
  const elapsedMs =
    unionActiveSeconds(
      webEntriesToday,
      entry ? new Date(correctedNowMs) : null,
    ) * 1000;

  // The day's total across every Project and device, shown beside the clock.
  // The summary already includes the running entry as of its fetch, so only
  // the time since then is added on top.
  const workedTodayMs =
    (dashboardQuery.data?.workedTodaySeconds ?? 0) * 1000 +
    (entry && !isPaused && dashboardQuery.dataUpdatedAt
      ? Math.max(0, localNowMs - dashboardQuery.dataUpdatedAt)
      : 0);

  return {
    limitReached,
    dismissLimitReached: () => setLimitReached(null),
    isLoading:
      currentQuery.isLoading ||
      organisationQuery.isLoading ||
      projectsQuery.isLoading,
    isError:
      currentQuery.isError ||
      organisationQuery.isError ||
      (projectsEnabled && (projectsQuery.isError || !projectsQuery.data)),
    projectsEnabled,
    entry: entry,
    activeProject,
    /** The web timer's own time today, running or not. */
    elapsedMs,
    /** Everything worked today, across every Project and device. */
    workedTodayMs,
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
    canSwitch,
    trackingNotice,
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    isSwitching: switchMutation.isPending,
    onProjectChange: (id: string) => {
      setProjectId(id);
      setTaskId("");
    },
    onTaskChange: setTaskId,
    onStart: () => startMutation.mutate(),
    onStop: () => stopMutation.mutate(),
    onSwitch: () => switchMutation.mutate(),
  };
}

export type RunningTimer = ReturnType<typeof useRunningTimer>;
