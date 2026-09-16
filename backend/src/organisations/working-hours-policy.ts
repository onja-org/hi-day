export interface WorkingHoursPolicy {
  hoursPerDay: number;
}

/** Applied whenever an Organisation hasn't explicitly set this (including
 * every org created before this existed) — informational only, never
 * enforced as a cap: a member can track more or less than this in a day. */
export const DEFAULT_WORKING_HOURS_PER_DAY = 8;

export const DEFAULT_WORKING_HOURS_POLICY: WorkingHoursPolicy = {
  hoursPerDay: DEFAULT_WORKING_HOURS_PER_DAY,
};
