import type { TimeEntry } from "@/types/timeEntry";

export type WebTimerConstraint = {
  /** The Project the web must start, when a device is already tracking one. */
  requiredProjectId: string | null;
};

/**
 * What the web's picker is allowed to start, given whichever device entry the
 * server reported.
 *
 * The web may track alongside a device, but only on the same Project: "my
 * laptop says X, this browser says Y" is a contradiction the person cannot
 * see, unlike two machines they started one at a time. Devices keep their
 * freedom to differ from each other.
 *
 * A *paused* device still constrains the choice even though it accrues
 * nothing — otherwise starting Y here and resuming X there would produce
 * exactly the split this prevents.
 */
export function webTimerConstraint(
  onDevice: TimeEntry | null,
): WebTimerConstraint {
  return { requiredProjectId: onDevice?.projectId ?? null };
}
