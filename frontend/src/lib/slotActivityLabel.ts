import type { ScreenshotSlot } from "@/types/screenshot";

/** Consecutive sample periods leave a small gap by design; half a minute
 * absorbs that without hiding a real hole. */
const COVERAGE_TOLERANCE_SECONDS = 30;

/** A period has to close and then wait for the agent's upload tick. */
const SETTLE_SECONDS = 600 + 60;

export type SlotActivityLabel =
  | { kind: "none" }
  | { kind: "not-recorded" }
  | { kind: "unmeasured" }
  | {
      kind: "measured";
      percentage: number;
      /** The reading covers materially less than the slot was worked for. */
      partial: boolean;
      measuredSeconds: number;
      workedSeconds: number;
    };

/**
 * Four states, sharing the timesheet's vocabulary: nothing tracked,
 * nothing recorded, not measured *yet*, or a reading. `0%` is only ever a
 * real reading.
 */
export function slotActivityLabel(
  slot: ScreenshotSlot,
  activityRecorded: boolean,
  nowMs: number = Date.now(),
): SlotActivityLabel {
  if (slot.workedSeconds <= 0) return { kind: "none" };
  if (slot.activePercentage === null) {
    // Decided on whether a figure could still arrive, not on the current
    // setting — which would call a stretch captured while recording was off
    // "pending" the moment somebody switched it back on.
    const settled = nowMs - Date.parse(slot.end) > SETTLE_SECONDS * 1000;
    return activityRecorded && !settled
      ? { kind: "unmeasured" }
      : { kind: "not-recorded" };
  }

  return {
    kind: "measured",
    percentage: slot.activePercentage,
    partial:
      slot.workedSeconds - slot.activityMeasuredSeconds >
      COVERAGE_TOLERANCE_SECONDS,
    measuredSeconds: slot.activityMeasuredSeconds,
    workedSeconds: slot.workedSeconds,
  };
}

export function slotWorkedMinutes(slot: ScreenshotSlot): number {
  return Math.round(slot.workedSeconds / 60);
}
