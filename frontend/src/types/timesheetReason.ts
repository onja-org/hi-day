import type { ApiResult } from "./api";

/**
 * One selectable label in the organisation's Reasons list. The label is
 * copied onto the audit row when picked, so renaming or deleting a Reason
 * changes only what the picker offers from then on.
 */
export type TimesheetReason = {
  id: string;
  label: string;
};

export type GetTimesheetReasonsResult =
  | { ok: true; reasons: TimesheetReason[] }
  | { ok: false; message: string };

export type UpsertTimesheetReasonResult = ApiResult<{
  reason: TimesheetReason;
}>;

export type DeleteTimesheetReasonResult = ApiResult;
