import { describe, expect, it } from "vitest";
import { parseSavedReports, removeSavedReport, upsertSavedReport } from "@/lib/savedReports";
import type { SavedReport } from "@/types/savedReport";

function report(id: string, modifiedAt = "2026-10-01T10:00:00Z"): SavedReport {
  return {
    id,
    name: `Report ${id}`,
    reportType: "time-and-activity",
    scheduled: false,
    modifiedAt,
    settings: {
      datePreset: "last_7_days",
      days: { from: "2026-09-28", to: "2026-10-04" },
      scope: "me",
      grouping: "day",
      filters: { memberIds: [], teamIds: [], projectIds: [] },
    },
  };
}

describe("parseSavedReports", () => {
  it("returns nothing for empty or missing storage", () => {
    expect(parseSavedReports(null)).toEqual([]);
    expect(parseSavedReports("")).toEqual([]);
  });

  it("round-trips a saved report", () => {
    expect(parseSavedReports(JSON.stringify([report("a")]))).toEqual([report("a")]);
  });

  it("returns nothing for malformed JSON or a non-array", () => {
    expect(parseSavedReports("{nope")).toEqual([]);
    expect(parseSavedReports('{"a":1}')).toEqual([]);
  });

  it("drops entries with the wrong shape", () => {
    const broken = { ...report("b"), settings: { ...report("b").settings, grouping: "nonsense" } };
    expect(parseSavedReports(JSON.stringify([report("a"), broken, 5, null]))).toEqual([report("a")]);
  });

  it("drops entries whose filters aren't string lists", () => {
    const broken = { ...report("b"), settings: { ...report("b").settings, filters: { memberIds: [1] } } };
    expect(parseSavedReports(JSON.stringify([broken]))).toEqual([]);
  });

  it("keeps a valid schedule", () => {
    const scheduled = {
      ...report("s"),
      schedule: {
        emails: ["a@b.co"],
        message: "hi",
        fileType: "pdf",
        dateRange: "last_week",
        frequency: "weekly",
        hour: 9,
        days: [1],
      },
    };
    expect(parseSavedReports(JSON.stringify([scheduled]))).toHaveLength(1);
  });

  it("drops a report whose schedule is malformed", () => {
    const broken = { ...report("s"), schedule: { emails: "nope" } };
    expect(parseSavedReports(JSON.stringify([broken]))).toEqual([]);
  });

  it("sorts newest first", () => {
    const older = report("old", "2026-09-01T10:00:00Z");
    const newer = report("new", "2026-10-01T10:00:00Z");
    expect(parseSavedReports(JSON.stringify([older, newer])).map((r) => r.id)).toEqual(["new", "old"]);
  });
});

describe("upsertSavedReport", () => {
  it("adds a new report", () => {
    expect(upsertSavedReport([report("a")], report("b")).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("replaces a report with the same id", () => {
    const renamed = { ...report("a"), name: "Renamed" };
    const result = upsertSavedReport([report("a"), report("b")], renamed);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Renamed");
  });
});

describe("removeSavedReport", () => {
  it("removes by id", () => {
    expect(removeSavedReport([report("a"), report("b")], "a").map((r) => r.id)).toEqual(["b"]);
  });
});
