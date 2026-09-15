import { describe, expect, it } from "vitest";
import { bucketWeekly, buildDailyTotals } from "@/lib/buildDailyTotals";
import type { TimeEntryListItem } from "@/types/timeEntry";

function entry(overrides: Partial<TimeEntryListItem>): TimeEntryListItem {
  return {
    id: `entry-${Math.random()}`,
    membershipId: "m-1",
    projectId: "p-1",
    taskId: null,
    startedAt: "2026-01-05T09:00:00.000Z",
    endedAt: "2026-01-05T10:00:00.000Z",
    source: "web",
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    projectName: "Website",
    projectColour: "blue",
    taskName: null,
    durationSeconds: 3600,
    canEdit: true,
    ...overrides,
  };
}

describe("buildDailyTotals", () => {
  it("zero-fills every day in the range and sums completed entries per local day", () => {
    const entries = [
      entry({
        startedAt: new Date(2026, 0, 5, 9, 0, 0).toISOString(),
        durationSeconds: 3600,
      }),
      entry({
        startedAt: new Date(2026, 0, 5, 14, 0, 0).toISOString(),
        durationSeconds: 1800,
      }),
      entry({
        startedAt: new Date(2026, 0, 7, 9, 0, 0).toISOString(),
        durationSeconds: 900,
      }),
    ];

    const totals = buildDailyTotals(
      entries,
      new Date(2026, 0, 5),
      new Date(2026, 0, 7),
    );

    expect(totals).toEqual([
      { dateKey: "2026-01-05", seconds: 5400 },
      { dateKey: "2026-01-06", seconds: 0 },
      { dateKey: "2026-01-07", seconds: 900 },
    ]);
  });

  it("excludes still-running entries (null durationSeconds) from the sum", () => {
    const entries = [
      entry({
        startedAt: new Date(2026, 0, 5, 9, 0, 0).toISOString(),
        endedAt: null,
        durationSeconds: null,
      }),
    ];

    const totals = buildDailyTotals(entries, new Date(2026, 0, 5), new Date(2026, 0, 5));

    expect(totals).toEqual([{ dateKey: "2026-01-05", seconds: 0 }]);
  });

  it("ignores entries outside the requested range", () => {
    const entries = [
      entry({
        startedAt: new Date(2025, 11, 1, 9, 0, 0).toISOString(),
        durationSeconds: 3600,
      }),
    ];

    const totals = buildDailyTotals(entries, new Date(2026, 0, 5), new Date(2026, 0, 5));

    expect(totals).toEqual([{ dateKey: "2026-01-05", seconds: 0 }]);
  });
});

describe("bucketWeekly", () => {
  it("chunks day totals into consecutive 7-day buckets and sums each", () => {
    const daily = Array.from({ length: 14 }, (_, index) => ({
      dateKey: `date-${index}`,
      seconds: 100,
    }));

    const buckets = bucketWeekly(daily);

    expect(buckets).toHaveLength(2);
    expect(buckets[0].seconds).toBe(700);
    expect(buckets[1].seconds).toBe(700);
  });

  it("labels a bucket by its covered date range within the same month", () => {
    const daily = buildDailyTotals(
      [],
      new Date(2026, 0, 1),
      new Date(2026, 0, 7),
    );

    const buckets = bucketWeekly(daily);

    expect(buckets).toEqual([{ label: "Jan 1–7", seconds: 0 }]);
  });

  it("handles a trailing partial bucket", () => {
    const daily = buildDailyTotals(
      [],
      new Date(2026, 0, 1),
      new Date(2026, 0, 10),
    );

    const buckets = bucketWeekly(daily);

    expect(buckets).toHaveLength(2);
    expect(buckets[1].label).toBe("Jan 8–10");
  });
});
