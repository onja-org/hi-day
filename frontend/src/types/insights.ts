import type { ApiResult } from "./api";

export type TimelineSegmentKind = "tracked" | "manual" | "idle";

export type TimelineSegment = {
  start: string;
  end: string;
  kind: TimelineSegmentKind;
  /** Only for `tracked`; manual and idle time have nothing to measure. */
  activePercentage: number | null;
};

export type TimelineDay = {
  /** `YYYY-MM-DD` on the organisation's calendar. */
  date: string;
  segments: TimelineSegment[];
  trackedSeconds: number;
  manualSeconds: number;
  idleSeconds: number;
  activePercentage: number | null;
};

/**
 * `disabled`: "Record activity" is off for this member; no percentages are
 *   sent, not even ones recorded before it went off.
 * `hidden`: you're viewing yourself and may not see your own activity — the
 * activity row is left out entirely rather than explained.
 */
export type InsightsActivityStatus = "recorded" | "disabled" | "hidden";

export type MemberTimeline = {
  membershipId: string;
  timezone: string;
  activityStatus: InsightsActivityStatus;
  days: TimelineDay[];
};

export type GetMemberTimelineResult = ApiResult<{ timeline: MemberTimeline }>;

export type MemberPerformance = {
  /** `null` when no expected work day has passed yet, or nothing was worked. */
  utilization: {
    averageDailySeconds: number;
    targetDailySeconds: number;
    expectedDays: number;
  } | null;
  /** `null` when nothing was measured, or activity isn't shown (see `activityStatus`). */
  activity: { percentage: number } | null;
  focus: {
    totalSeconds: number;
    sessions: number;
    averageSessionSeconds: number;
  } | null;
  /** Medians over worked days, in minutes from midnight on the organisation's calendar. */
  startStop: { startMinute: number; stopMinute: number; days: number } | null;
  /** `idleShare` is 0–1, of tracked plus idle time. */
  idle: { idleSeconds: number; idleShare: number } | null;
};

/** Each card's comparison figure, averaged over a group of members. */
export type PerformanceAverages = {
  averageDailySeconds: number | null;
  activityPercentage: number | null;
  focusSeconds: number | null;
  startMinute: number | null;
  stopMinute: number | null;
  idleShare: number | null;
  members: number;
};

export type MemberPerformanceReport = {
  membershipId: string;
  timezone: string;
  activityStatus: InsightsActivityStatus;
  member: MemberPerformance;
  averages: {
    organisation: PerformanceAverages;
    /** `null` when the member is on no team. */
    team: PerformanceAverages | null;
  };
  workTimeClassification: { status: "not_set_up" };
};

export type GetMemberPerformanceResult = ApiResult<{ report: MemberPerformanceReport }>;

/** One line of a Performance card's comparison: the member, or an average. */
export type ComparisonRow = {
  label: string;
  /** Where the bar runs on the scale; a plain figure runs from 0. `null` draws no bar. */
  span: { start: number; end: number } | null;
  display: string;
  /** The member's own row, drawn in the brand colour; averages are muted. */
  highlight?: boolean;
};

/** What every Performance card is rendered from. */
export type PerformanceCardInput = {
  report: MemberPerformanceReport;
  /** "You" on your own page, otherwise "This member". */
  memberLabel: string;
};

/** The per-member Insights pages, as they appear in URLs. */
export type InsightsPage = "timeline" | "performance";

/** Where an Insights link points: one member's page, or the member list on its way to a page. */
export type InsightsDestination =
  | { kind: "page"; page: InsightsPage; member: string | null }
  | { kind: "list"; page: InsightsPage };
