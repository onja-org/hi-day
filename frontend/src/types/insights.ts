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
