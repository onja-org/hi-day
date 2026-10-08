import { describe, expect, it } from "vitest";
import { todayProjectTimes } from "@/lib/todayProjectTimes";
import type { DashboardProjectTime } from "@/types/dashboardSummary";

function project(projectId: string, seconds: number): DashboardProjectTime {
  return { projectId, projectName: `Project ${projectId}`, projectColour: "blue", seconds };
}

describe("todayProjectTimes", () => {
  it("returns completed time, busiest first, when nothing is running", () => {
    const rows = todayProjectTimes(
      { projectsToday: [project("a", 600), project("b", 1200)], projectsThisWeek: [], workedTodaySeconds: 1800 },
      null,
    );

    expect(rows.map((row) => [row.projectId, row.seconds])).toEqual([
      ["b", 1200],
      ["a", 600],
    ]);
  });

  it("adds the live time to the running project's completed time", () => {
    const rows = todayProjectTimes(
      { projectsToday: [project("a", 600), project("b", 1200)], projectsThisWeek: [], workedTodaySeconds: 2700 },
      "a",
    );

    expect(rows.map((row) => [row.projectId, row.seconds])).toEqual([
      ["a", 1500],
      ["b", 1200],
    ]);
  });

  it("adds a row for a running project with nothing completed today, named from this week", () => {
    const rows = todayProjectTimes(
      { projectsToday: [project("a", 600)], projectsThisWeek: [project("c", 9000)], workedTodaySeconds: 1500 },
      "c",
    );

    expect(rows).toEqual([
      { projectId: "c", projectName: "Project c", projectColour: "blue", seconds: 900 },
      { projectId: "a", projectName: "Project a", projectColour: "blue", seconds: 600 },
    ]);
  });

  it("never subtracts when overlapping entries make the total smaller than the parts", () => {
    const rows = todayProjectTimes(
      { projectsToday: [project("a", 600), project("b", 600)], projectsThisWeek: [], workedTodaySeconds: 900 },
      "a",
    );

    expect(rows.map((row) => row.seconds)).toEqual([600, 600]);
  });
});
