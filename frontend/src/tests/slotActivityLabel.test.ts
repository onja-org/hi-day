import { describe, expect, it } from "vitest";
import { slotActivityLabel, slotWorkedMinutes } from "@/lib/slotActivityLabel";
import type { ScreenshotSlot } from "@/types/screenshot";

function slot(overrides: Partial<ScreenshotSlot> = {}): ScreenshotSlot {
  return {
    start: "2026-03-10T09:00:00.000Z",
    end: "2026-03-10T09:10:00.000Z",
    projectId: null,
    workedSeconds: 600,
    activePercentage: 80,
    activityMeasuredSeconds: 600,
    screenshots: [],
    extraCount: 0,
    ...overrides,
  };
}

describe("slotActivityLabel", () => {
  it("reports a measured percentage that covers the slot", () => {
    expect(slotActivityLabel(slot(), true, Date.parse(slot().end))).toEqual({
      kind: "measured",
      percentage: 80,
      partial: false,
      measuredSeconds: 600,
      workedSeconds: 600,
    });
  });

  it("calls a slot with no tracked time 'none', not zero activity", () => {
    expect(
      slotActivityLabel(
        slot({ workedSeconds: 0, activePercentage: null }),
        true,
        Date.parse(slot().end),
      ),
    ).toEqual({ kind: "none" });
  });

  describe("a slot with no figure", () => {
    const withoutFigure = slot({
      activePercentage: null,
      activityMeasuredSeconds: 0,
    });
    const slotEnd = Date.parse(withoutFigure.end);
    const justAfter = slotEnd + 60_000;
    const longAfter = slotEnd + 2 * 60 * 60_000;

    it("is 'not recorded' when recording is off for this member", () => {
      expect(slotActivityLabel(withoutFigure, false, justAfter)).toEqual({
        kind: "not-recorded",
      });
    });

    // The period has to close and then wait for the agent's upload tick, so
    // a freshly-ended slot legitimately has nothing yet.
    it("is merely unmeasured while the figure could still be arriving", () => {
      expect(slotActivityLabel(withoutFigure, true, justAfter)).toEqual({
        kind: "unmeasured",
      });
    });

    // This is a stretch captured *while* recording was off, read after
    // somebody turned it back on: nothing is coming, and calling it pending
    // would be a lie that never resolves.
    it("is 'not recorded' once the figure has had every chance to arrive", () => {
      expect(slotActivityLabel(withoutFigure, true, longAfter)).toEqual({
        kind: "not-recorded",
      });
    });
  });

  // 0% is a real reading: they were at the keyboard for none of it.
  it("keeps a genuine zero as a measured reading", () => {
    expect(slotActivityLabel(slot({ activePercentage: 0 }), true, Date.parse(slot().end))).toMatchObject(
      { kind: "measured", percentage: 0 },
    );
  });

  // Recording switched on part-way, or an agent that dropped out: the
  // percentage describes a slice, and a bare number would overstate it.
  it("marks a reading that covers materially less than the slot", () => {
    expect(
      slotActivityLabel(
        slot({ workedSeconds: 600, activityMeasuredSeconds: 240 }),
        true,
        Date.parse(slot().end),
      ),
    ).toMatchObject({ kind: "measured", partial: true, measuredSeconds: 240 });
  });

  // Consecutive sample periods leave a small gap by design, so a few
  // seconds short is normal rather than a hole worth flagging.
  it("does not mark a shortfall inside the normal period gap", () => {
    expect(
      slotActivityLabel(
        slot({ workedSeconds: 600, activityMeasuredSeconds: 580 }),
        true,
        Date.parse(slot().end),
      ),
    ).toMatchObject({ partial: false });
  });
});

describe("slotWorkedMinutes", () => {
  it("rounds to whole minutes", () => {
    expect(slotWorkedMinutes(slot({ workedSeconds: 330 }))).toBe(6);
    expect(slotWorkedMinutes(slot({ workedSeconds: 0 }))).toBe(0);
  });
});
