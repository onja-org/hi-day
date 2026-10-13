import type { ApiResult } from "./api";
import type {
  AllowedApps,
  AppUrlTracking,
  TimesheetModifyTime,
} from "./organisation";

export type MembershipRole = "admin" | "manager" | "member" | "finance";

export type MembershipStatus = "active" | "deactivated";

export type ActiveMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  teamIds: string[];
  status: MembershipStatus;
  joinedAt: string;
  /** Which disclosure/consent text this person sees — see CONTEXT.md's Disclosure region entry. `null` means the org's region-less default. */
  disclosureRegion: string | null;
  /** Their own IANA zone; null until a client has reported one. */
  timezone: string | null;
  /** Per-member override of the org's Track apps & URLs default; `null` inherits. */
  appUrlTracking: AppUrlTracking | null;
  /** `null` inherits the organisation's; `0` is "None". */
  screenshotFrequencySeconds: number | null;
  /** `null` means inherit the organisation's Allowed apps default. */
  allowedApps: AllowedApps | null;
  /** Work time limit overrides; each `null` inherits the organisation's. */
  expectedWorkDays: number[] | null;
  trackingDisabledDays: number[] | null;
  expectedWeeklyHours: number | null;
  weeklyLimitHours: number | null;
  dailyLimitHours: number | null;
  /** Per-member override of the org's Timesheets "Modify time" default; `null` inherits. */
  timesheetModifyTime: TimesheetModifyTime | null;
  /** Per-member override of the org's Timesheets "Require approval" default; `null` inherits. */
  timesheetRequireApproval: boolean | null;
};

/** A Members-page row — see the backend's ActiveMemberListItem. */
export type ActiveMemberListItem = ActiveMember & {
  /** Direct project memberships only, not access via a team. */
  projectIds: string[];
};

export type PasswordResetResult = {
  membershipId: string;
  email: string | null;
  outcome: "sent" | "skipped";
  message?: string;
};

export type SendPasswordResetsResult = ApiResult<{ results: PasswordResetResult[] }>;

export type GetActiveMembersResult =
  | { ok: true; members: ActiveMemberListItem[] }
  | { ok: false; message: string };

export type UpdateMembershipInput = {
  role?: MembershipRole;
  deactivate?: boolean;
  disclosureRegion?: string | null;
  firstName?: string;
  lastName?: string;
  /** `null` clears the override; omit to leave the override as-is. */
  appUrlTracking?: AppUrlTracking | null;
  screenshotFrequencySeconds?: number | null;
  allowedApps?: AllowedApps | null;
  expectedWorkDays?: number[] | null;
  trackingDisabledDays?: number[] | null;
  expectedWeeklyHours?: number | null;
  weeklyLimitHours?: number | null;
  dailyLimitHours?: number | null;
  /** `null` clears the override; omit to leave the override as-is. */
  timesheetModifyTime?: TimesheetModifyTime | null;
  /** `null` clears the override; omit to leave the override as-is. */
  timesheetRequireApproval?: boolean | null;
};

export type UpdateMembershipResult = ApiResult<{ member: ActiveMember }>;
