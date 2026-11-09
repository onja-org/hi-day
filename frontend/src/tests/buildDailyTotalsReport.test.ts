import { describe, expect, it } from "vitest";
import { buildDailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import type { TimeEntryListItem } from "@/types/timeEntry";

function entry(membershipId: string, day: string, seconds: number, at = "10:00"): TimeEntryListItem {
  const startedAt = new Date(`${day}T${at}:00`);
  return {
    id: `${membershipId}-${day}-${at}-${seconds}`,
    membershipId,
    memberName: `Member ${membershipId}`,
    startedAt: startedAt.toISOString(),
    endedAt: new Date(startedAt.getTime() + seconds * 1000).toISOString(),
    durationSeconds: seconds,
    source: "web",
    pausedSeconds: 0,
    pausedAt: null,
    pauses: [],
  } as unknown as TimeEntryListItem;
}

const range = { from: new Date("2026-10-01T00:00:00"), to: new Date("2026-10-03T23:59:59") };

describe("buildDailyTotalsReport", () => {
  it("cuts days in the given zone, whatever the browser's is", () => {
    // "Today" in Nairobi (UTC+3): one day, and 23:30 UTC belongs to the next.
    const today = { from: new Date("2026-10-12T21:00:00Z"), to: new Date("2026-10-13T20:59:59.999Z") };
    const late = { ...entry("a", "2026-10-12", 60), startedAt: "2026-10-12T23:30:00Z" };
    const report = buildDailyTotalsReport([late], today, "Africa/Nairobi");
    expect(report.columns.map((column) => column.key)).toEqual(["2026-10-13"]);
    expect(report.totalRow.cells["2026-10-13"]).toBe("00:01:00");
  });

  it("makes a column per day, zero-filled", () => {
    const report = buildDailyTotalsReport([], range);
    expect(report.columns.map((column) => column.key)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(report.rows).toEqual([]);
  });

  it("sums per member and per day into the total row", () => {
    const report = buildDailyTotalsReport(
      [entry("a", "2026-10-01", 3600), entry("a", "2026-10-01", 1800, "14:00"), entry("b", "2026-10-03", 60)],
      range,
    );
    expect(report.rows).toHaveLength(2);
    expect(report.rows[0].cells.member).toBe("Member a");
    expect(report.rows[0].cells["2026-10-01"]).toBe("01:30:00");
    expect(report.rows[0].cells["2026-10-02"]).toBe("-");
    expect(report.totalRow.cells.total).toBe("01:31:00");
    expect(report.totalRow.cells["2026-10-03"]).toBe("00:01:00");
  });

  // ADR-0022: a person may track on two Devices at once, and the hours they
  // share count once.
  it("counts an hour tracked on two devices at once as one hour", () => {
    const report = buildDailyTotalsReport(
      [entry("a", "2026-10-01", 3600), { ...entry("a", "2026-10-01", 3600), id: "laptop" }],
      range,
    );
    expect(report.rows[0].cells["2026-10-01"]).toBe("01:00:00");
    expect(report.totalRow.cells["2026-10-01"]).toBe("01:00:00");
    expect(report.days[0].seconds).toBe(3600);
  });

  it("still adds up two people who worked the same hour", () => {
    const report = buildDailyTotalsReport(
      [entry("a", "2026-10-01", 3600), entry("b", "2026-10-01", 3600)],
      range,
    );
    expect(report.totalRow.cells["2026-10-01"]).toBe("02:00:00");
    expect(report.totalRow.cells.total).toBe("02:00:00");
    expect(report.days[0].seconds).toBe(7200);
  });
});
