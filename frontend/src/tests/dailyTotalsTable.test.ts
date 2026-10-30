import { describe, expect, it } from "vitest";
import { buildDailyTotalsReport } from "@/lib/buildDailyTotalsReport";
import { dailyTotalsTable } from "@/lib/dailyTotalsTable";
import { reportTableToCsv } from "@/lib/reportTableToCsv";
import type { TimeEntryListItem } from "@/types/timeEntry";

function entry(membershipId: string, memberName: string, startedAt: string, endedAt: string): TimeEntryListItem {
  return {
    id: `${membershipId}-${startedAt}`,
    membershipId,
    projectId: "p-1",
    projectName: "Website",
    projectColour: "blue",
    taskId: null,
    taskName: null,
    startedAt,
    endedAt,
    source: "web",
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    durationSeconds: (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    type: "normal",
    activePercentage: null,
    memberName,
    memberEmail: null,
    canEdit: true,
    canDelete: true,
    pauses: [],
  };
}

// Local noon times so the entries sit on the same local day in any runtime zone.
const day = (d: number, h: number) => new Date(2026, 9, d, h).toISOString();
const range = { from: new Date(2026, 9, 5), to: new Date(2026, 9, 6, 23, 59, 59) };

describe("dailyTotalsTable", () => {
  const report = buildDailyTotalsReport(
    [entry("m-1", "Sam", day(5, 9), day(5, 11)), entry("m-2", "Lee, Jo", day(6, 9), day(6, 10))],
    range,
  );
  const table = dailyTotalsTable(report);

  it("puts the member column first and the totals last, with a daily total row at the end", () => {
    expect(table.columns.map((c) => c.header)).toEqual([
      "Member",
      ...report.columns.map((c) => c.header),
      "Time Off",
      "Total worked",
    ]);
    expect(table.rows).toEqual([...report.rows, report.totalRow]);
  });

  it('exports CSV with "-" for empty cells, matching the old Daily totals export', () => {
    const lines = [
      // "-" is escaped as a spreadsheet formula trigger by toCsvString.
      `Sam,02:00:00,'-,'-,02:00:00`,
      `"Lee, Jo",'-,01:00:00,'-,01:00:00`,
      `Daily total,02:00:00,01:00:00,'-,03:00:00`,
    ];
    // The day headings are locale-formatted, so only the body lines are compared verbatim.
    expect(reportTableToCsv(table.columns, table.rows).split("\n").slice(1)).toEqual(lines);
  });
});
