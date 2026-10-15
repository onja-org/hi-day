import { describe, expect, it } from "vitest";
import {
  TIMESHEET_EXPORT_HEADER,
  timesheetExportHeader,
  timesheetExportRows,
} from "@/lib/timesheetExportRows";
import type { TimeEntryListItem } from "@/types/timeEntry";

function makeEntry(overrides: Partial<TimeEntryListItem> = {}): TimeEntryListItem {
  return {
    id: "te-1",
    membershipId: "m-1",
    projectId: "p-1",
    projectName: "Website",
    projectColour: "blue",
    taskId: null,
    taskName: null,
    startedAt: "2026-01-05T09:00:00.000Z",
    endedAt: "2026-01-05T10:00:00.000Z",
    source: "web",
    deviceId: null,
    pausedAt: null,
    pausedSeconds: 0,
    durationSeconds: 3600,
    type: "normal",
    activePercentage: null,
    memberName: "Sam Rivers",
    memberEmail: "sam@example.test",
    canEdit: true,
    canDelete: true,
    pauses: [],
    ...overrides,
  };
}

describe("timesheetExportRows", () => {
  const NAIROBI = "Africa/Nairobi"; // UTC+3
  const NEW_YORK = "America/New_York"; // UTC-5 in January

  it("writes one row per entry, matching the header's width", () => {
    const rows = timesheetExportRows([makeEntry(), makeEntry()], NAIROBI);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(TIMESHEET_EXPORT_HEADER.length);
  });

  it("dates a row by the day it falls on in the given zone", () => {
    const entry = makeEntry({ startedAt: "2026-01-05T22:30:00.000Z" });

    // 22:30Z is already the 6th in Nairobi, still the 5th in New York.
    expect(timesheetExportRows([entry], NAIROBI)[0][0]).toContain("1/6/2026");
    expect(timesheetExportRows([entry], NEW_YORK)[0][0]).toContain("1/5/2026");
  });

  it("marks a still-running entry in progress with a blank duration", () => {
    const [row] = timesheetExportRows(
      [makeEntry({ endedAt: null, durationSeconds: null })],
      NAIROBI,
    );

    expect(row[4]).toBe("In progress");
    expect(row[5]).toBe("");
  });

  it("rounds paused time to whole minutes", () => {
    const [row] = timesheetExportRows(
      [makeEntry({ pausedSeconds: 100 })],
      NAIROBI,
    );

    expect(row[6]).toBe("2");
  });

  it("returns nothing for no entries", () => {
    expect(timesheetExportRows([], NAIROBI)).toEqual([]);
  });
});

describe("timesheetExportRows with Projects off", () => {
  it("drops the project from the header and every row together", () => {
    const header = timesheetExportHeader(false);
    const [row] = timesheetExportRows([makeEntry()], "UTC", false);

    expect(header).not.toContain("Project");
    expect(row).toHaveLength(header.length);
    expect(row).not.toContain("Website");
  });
});
