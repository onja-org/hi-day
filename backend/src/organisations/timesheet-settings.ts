/**
 * Who is allowed to add manual time and edit previously-tracked time on
 * their timesheet — the organisation default, overridable per Membership.
 * `off` means the timesheet is read-only; `add_edit` means manual entries
 * and edits are allowed (subject to the require-approval policy).
 */
export type TimesheetModifyTime = 'off' | 'add_edit';

export const TIMESHEET_MODIFY_TIME_VALUES: readonly TimesheetModifyTime[] = [
  'off',
  'add_edit',
];

/** Applied when an Organisation hasn't customised this yet. */
export const DEFAULT_TIMESHEET_MODIFY_TIME: TimesheetModifyTime = 'add_edit';

/**
 * Whether a manual entry or edit needs approval before it counts. Set at
 * the Organisation level, overridable per Membership (null = inherit).
 */
export const DEFAULT_TIMESHEET_REQUIRE_APPROVAL = false;

/**
 * Whether a manager may approve or deny their own manual time, rather than
 * only another manager being able to. Organisation-wide, no per-member
 * override — this is a trust-boundary rule, not a per-person preference.
 */
export const DEFAULT_TIMESHEET_MANAGERS_APPROVE_OWN = false;

/**
 * Whether a Reason has to be given when adding, editing or deleting time.
 * Defaults to `true` because the forms have always demanded one: an
 * Organisation that upgrades into this setting keeps the behaviour it had.
 */
export const DEFAULT_TIMESHEET_REQUIRE_REASON = true;

/** How long one Reason's label may be. Matches the free-text field it replaces. */
export const TIMESHEET_REASON_MAX_LENGTH = 100;

/**
 * A ceiling on the Reasons list. Not a technical limit — a picker with
 * hundreds of options stops being quicker than typing, which is the whole
 * point of offering a list.
 */
export const MAX_TIMESHEET_REASONS = 50;

/** Seeded for a new Organisation so the picker is never empty on day one. */
export const DEFAULT_TIMESHEET_REASONS: readonly string[] = [
  'Forgot to start timer',
  'Forgot to stop timer',
  'Client meeting',
];
