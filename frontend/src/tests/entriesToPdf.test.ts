import { describe, expect, it } from "vitest";
import { entriesToPdf } from "@/lib/entriesToPdf";
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

describe("entriesToPdf", () => {
  const NAIROBI = "Africa/Nairobi";

  it("produces a non-empty PDF blob", async () => {
    const blob = entriesToPdf("Timesheet", [makeEntry()], NAIROBI);

    expect(blob.type).toContain("pdf");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("still produces a document when there are no entries", () => {
    expect(entriesToPdf("Timesheet", [], NAIROBI).size).toBeGreaterThan(0);
  });

  it("names the zone in the title, so a page can't be read on the wrong clock", async () => {
    const text = await entriesToPdf("Timesheet", [makeEntry()], NAIROBI).text();

    // jsPDF writes page text uncompressed by default.
    expect(text).toContain("EAT");
  });
});
