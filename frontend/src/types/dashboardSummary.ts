import type { ProjectColour } from "./project";

export type DashboardWeekDay = {
  /** YYYY-MM-DD, Sunday-Saturday, zero-filled for days with no entries. */
  date: string;
  seconds: number;
};

export type DashboardProjectTime = {
  projectId: string;
  projectName: string;
  projectColour: ProjectColour;
  seconds: number;
};

export type DashboardSummary = {
  workedTodaySeconds: number;
  /** vs. yesterday, same time-of-day. */
  workedTodayDeltaSeconds: number;
  /** Week-to-date (Sunday through now), not a full 7-day total. */
  workedThisWeekSeconds: number;
  /** vs. last week, same elapsed span. */
  workedThisWeekDeltaSeconds: number;
  projectsWorkedThisWeek: number;
  projectsWorkedDelta: number;
  /** Always 7 entries, Sunday-Saturday. */
  thisWeekByDay: DashboardWeekDay[];
  /** Desc by seconds worked this week. */
  projectsThisWeek: DashboardProjectTime[];
  /**
   * Today's per-project totals from *completed* entries only — excludes
   * whatever's still running. Add a live-ticking timer's own elapsed time
   * on top of this rather than trusting it alone, or a running project's
   * total double-counts (once from here, once from the tick) or goes stale
   * between polls.
   */
  projectsToday: DashboardProjectTime[];
  /** Admin-configurable, default 8 — informational only, never enforced. */
  workingHoursPerDayTarget: number;
};

export type GetDashboardSummaryResult =
  | { ok: true; summary: DashboardSummary }
  | { ok: false; message: string };
