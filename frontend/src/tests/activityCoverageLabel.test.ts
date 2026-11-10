import { describe, expect, it } from "vitest";
import { activityCoverageLabel } from "@/lib/activityCoverageLabel";
import type { TimeEntryListItem } from "@/types/timeEntry";

function entry(overrides: Partial<TimeEntryListItem>): TimeEntryListItem {
  return {
    activePercentage: 90,
    activityCoveredSeconds: null,
    activityMeasurableSeconds: null,
    ...overrides,
  } as TimeEntryListItem;
}

describe("activityCoverageLabel", () => {
  it("says nothing when the whole entry was measured", () => {
    expect(
      activityCoverageLabel(
        entry({ activityCoveredSeconds: 3600, activityMeasurableSeconds: 3600 }),
      ),
    ).toBeNull();
  });

  // Record activity switched on 40 minutes into a 50-minute entry: the 90%
  // describes 10 minutes, and would otherwise read as describing all 50.
  it("reports the measured slice when recording started part-way through", () => {
    expect(
      activityCoverageLabel(
        entry({ activityCoveredSeconds: 600, activityMeasurableSeconds: 3000 }),
      ),
    ).toBe("Covers 00:10:00 of 00:50:00 tracked");
  });

  // A healthy running timer is behind by the period still open plus one
  // closed period awaiting the queue's next flush — 11 minutes, not 10.
  // Counting only the open period labelled healthy timers.
  it("ignores the open period plus one upload cycle", () => {
    expect(
      activityCoverageLabel(
        entry({ activityCoveredSeconds: 3600, activityMeasurableSeconds: 4260 }),
      ),
    ).toBeNull();
  });

  it("reports a shortfall beyond the expected pipeline lag", () => {
    expect(
      activityCoverageLabel(
        entry({ activityCoveredSeconds: 3600, activityMeasurableSeconds: 4320 }),
      ),
    ).toBe("Covers 01:00:00 of 01:12:00 tracked");
  });

  it("says nothing when a backend sends no coverage at all", () => {
    expect(
      activityCoverageLabel(
        entry({
          activityCoveredSeconds: undefined,
          activityMeasurableSeconds: undefined,
        }),
      ),
    ).toBeNull();
  });
});
