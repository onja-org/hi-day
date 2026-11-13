import type { ApiResult } from "./api";
import type { InsightsActivityStatus } from "./insights";

export type UnusualSeverity = "highly_unusual" | "unusual" | "slightly_unusual";

export type UnusualRule =
  | "consistent_activity"
  | "high_activity"
  | "breakless_work"
  | "sustained_high_activity";

/** A stretch that stood out: overlapping findings reported once, strongest reason first. */
export type UnusualInstance = {
  /** `YYYY-MM-DD` on the organisation's calendar. */
  date: string;
  start: string;
  end: string;
  durationSeconds: number;
  severity: UnusualSeverity;
  rules: UnusualRule[];
  reasons: string[];
};

export type SecondsBySeverity = Record<UnusualSeverity, number>;

export type MemberUnusualActivity = {
  membershipId: string;
  timezone: string;
  activityStatus: InsightsActivityStatus;
  /** The last day checked — a day is only checked once it's over. `null` when none in the range is. */
  checkedThrough: string | null;
  instances: UnusualInstance[];
  affectedSeconds: SecondsBySeverity;
  previousPeriod: { from: string; to: string; affectedSeconds: SecondsBySeverity };
  /** Rules not flagged because they're this member's usual way of working. */
  normalForMember: UnusualRule[];
};

export type GetMemberUnusualActivityResult = ApiResult<{ report: MemberUnusualActivity }>;

/** The figures the summary shows for the severities currently selected. */
export type UnusualActivitySummary = {
  counts: Record<UnusualSeverity, number>;
  instances: UnusualInstance[];
  affectedSeconds: number;
  previousAffectedSeconds: number;
};
