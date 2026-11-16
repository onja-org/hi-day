import type { ApiResult } from "./api";
import type { ComparisonRow, InsightsActivityStatus } from "./insights";
import type { UnusualInstance, UnusualSeverity } from "./unusualActivity";

/** The Performance figures Highlights watches for a change in behaviour. */
export type BehaviourMetric = "core_work" | "activity" | "focus_time";

/** A metric that moved 15% or more from the member's own recent average. */
export type BehaviourChange = {
  metric: BehaviourMetric;
  direction: "higher" | "lower";
  /** How far from the average, as a whole percentage of it. */
  changePercent: number;
  /** In the metric's own unit: a 0–1 share (core work), a percentage (activity), or seconds (focus time). */
  current: number;
  average: number;
};

export type MemberHighlights = {
  membershipId: string;
  timezone: string;
  activityStatus: InsightsActivityStatus;
  /** The last day included — only finished days are looked at. `null` when none in the range is. */
  checkedThrough: string | null;
  /** The same figures as the Unusual activity page for this member and range. */
  unusualActivity: {
    counts: Record<UnusualSeverity, number>;
    affectedSeconds: number;
    previousAffectedSeconds: number;
    /** The most serious instances (at most 3); the Unusual activity page has the rest. */
    topInstances: UnusualInstance[];
  };
  behaviourChanges: {
    /** The earlier periods the checked days were compared with, together. `null` when nothing was compared. */
    comparedWith: { from: string; to: string; periods: number } | null;
    /** Length in days of the selected range, and so of each earlier period. */
    periodDays: number;
    /** How many of its days are over and were compared; while fewer, only the same days of each earlier period count. */
    checkedDays: number;
    changes: BehaviourChange[];
  };
};

export type GetMemberHighlightsResult = ApiResult<{ report: MemberHighlights }>;

/** One behaviour-change note, ready to show: the change, what it's against, and two bars. */
export type BehaviourChangeNote = {
  /** e.g. "Core work" */
  label: string;
  /** e.g. "19% lower" — the part to emphasise. */
  change: string;
  /** e.g. "Compared with their own average over the previous 3 weeks." */
  comparison: string;
  /** "This period" against the average, on one scale. */
  rows: ComparisonRow[];
  max: number;
};
