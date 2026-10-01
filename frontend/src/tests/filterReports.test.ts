import { describe, expect, it } from "vitest";
import { filterReports } from "@/lib/filterReports";
import type { Report } from "@/types/report";

const reports: Report[] = [
  { id: "a", title: "Work sessions", description: "Start and stop times", section: "general" },
  { id: "b", title: "Payments", description: "How much was paid", section: "payment" },
];

describe("filterReports", () => {
  it("returns every report for a blank query", () => {
    expect(filterReports(reports, "   ")).toEqual(reports);
  });

  it("matches on title, ignoring case", () => {
    expect(filterReports(reports, "WORK")).toEqual([reports[0]]);
  });

  it("matches on description", () => {
    expect(filterReports(reports, "paid")).toEqual([reports[1]]);
  });

  it("returns nothing when no report matches", () => {
    expect(filterReports(reports, "zzz")).toEqual([]);
  });
});
