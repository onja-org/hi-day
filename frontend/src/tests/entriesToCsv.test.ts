import { describe, expect, it } from "vitest";
import { entriesToCsv } from "@/lib/entriesToCsv";
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
    canEdit: true,
    pauses: [],
    ...overrides,
  };
}

describe("entriesToCsv", () => {
  it("writes a header row followed by one row per entry", () => {
    const csv = entriesToCsv([makeEntry()]);
    const lines = csv.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("Date,Project,Task,Start,End,Duration,Paused (min),Source");
    expect(lines[1]).toContain("Website");
    expect(lines[1]).toContain("01:00:00");
  });

  it("quotes and escapes a field containing a comma", () => {
    const csv = entriesToCsv([makeEntry({ projectName: "Acme, Inc." })]);

    expect(csv).toContain('"Acme, Inc."');
  });

  it("quotes and doubles an embedded quote character", () => {
    const csv = entriesToCsv([makeEntry({ taskName: 'Say "hi"' })]);

    expect(csv).toContain('"Say ""hi"""');
  });

  it("marks a still-running entry as in progress with a blank duration", () => {
    const csv = entriesToCsv([
      makeEntry({ endedAt: null, durationSeconds: null }),
    ]);
    const dataRow = csv.split("\n")[1];

    expect(dataRow).toContain("In progress");
  });

  it("returns just the header row for no entries", () => {
    expect(entriesToCsv([]).split("\n")).toHaveLength(1);
  });
});
