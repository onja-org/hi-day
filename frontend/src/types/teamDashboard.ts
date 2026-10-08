import type { DashboardProjectTime } from "./dashboardSummary";
import type { ScreenshotSummaryItem } from "./screenshot";

export type TeamMemberStatus = {
  membershipId: string;
  name: string | null;
  email: string;
  isWorking: boolean;
  currentProjectName: string | null;
  workedTodaySeconds: number;
  workedThisWeekSeconds: number;
};

export type TeamMemberScreenshots = {
  membershipId: string;
  name: string | null;
  /** Most recent first. */
  screenshots: ScreenshotSummaryItem[];
};

export type TeamAppOrSiteUsage = {
  /** A native app's name (e.g. "Slack") or, for browser time, the visited
   * domain (e.g. "docs.google.com"). */
  label: string;
  seconds: number;
};

export type TeamTime = {
  teamId: string;
  teamName: string;
  seconds: number;
};

export type TeamDashboardSummary = {
  memberCount: number;
  workedThisWeekSeconds: number;
  /** vs. last week, same elapsed span. */
  workedThisWeekDeltaSeconds: number;
  projectsWorkedThisWeek: number;
  projectsWorkedDelta: number;
  /** Desc by seconds worked this week, aggregated across every scoped member. */
  projectsThisWeek: DashboardProjectTime[];
  /** Desc by seconds worked this week. */
  members: TeamMemberStatus[];
  /** Capped to a small number of members, busiest today first. */
  recentActivity: TeamMemberScreenshots[];
  /** Combined app + browser-domain usage this week across every scoped
   * member — desc by seconds, capped to a small top-N. */
  appsAndSites: TeamAppOrSiteUsage[];
  /** Each visible team's members' time this week — every team for an
   * admin, only the managed ones for a manager — desc by seconds. Someone
   * in two teams counts towards both. */
  teamsThisWeek: TeamTime[];
};

export type GetTeamDashboardSummaryResult =
  | { ok: true; summary: TeamDashboardSummary }
  | { ok: false; message: string };
