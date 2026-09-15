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
  /** null when no activity samples exist yet — render "—", not a fake 0%. */
  weeklyActivityPercentage: number | null;
  weeklyActivityDeltaPercentage: number | null;
  /** Always 7 entries, Sunday-Saturday. */
  thisWeekByDay: DashboardWeekDay[];
  /** Desc by seconds worked this week. */
  projectsThisWeek: DashboardProjectTime[];
};

export type GetDashboardSummaryResult =
  | { ok: true; summary: DashboardSummary }
  | { ok: false; message: string };
