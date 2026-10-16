import { describe, expect, it } from "vitest";
import { appActivityRows } from "@/lib/appActivityRows";
import type { AppActivityDay } from "@/types/appActivity";

const projects = [{ id: "p-1", name: "Website" }];

function makeDay(overrides: Partial<AppActivityDay> = {}): AppActivityDay {
  return {
    date: "2026-09-18",
    totalSecondsSpent: 0,
    buckets: [],
    ...overrides,
  };
}

describe("appActivityRows", () => {
  it("writes the expected header", () => {
    expect(appActivityRows(makeDay(), projects).header).toEqual([
      "Hour",
      "Project",
      "App",
      "Time spent",
      "Sessions",
    ]);
  });

  it("writes one row per app item, resolving its project name", () => {
    const day = makeDay({
      buckets: [
        {
          hourStart: "2026-09-18T09:00:00.000Z",
          items: [
            { projectId: "p-1", appName: "Code Editor", secondsSpent: 3600, sessionCount: 4 },
          ],
        },
      ],
    });

    const { rows } = appActivityRows(day, projects);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("Website");
    expect(rows[0]).toContain("Code Editor");
    expect(rows[0]).toContain("01:00:00");
    expect(rows[0]).toContain("4");
  });

  it("resolves a null projectId to 'No project'", () => {
    const day = makeDay({
      buckets: [
        {
          hourStart: "2026-09-18T09:00:00.000Z",
          items: [{ projectId: null, appName: "Browser", secondsSpent: 60, sessionCount: 1 }],
        },
      ],
    });

    expect(appActivityRows(day, projects).rows[0]).toContain("No project");
  });

  it("returns no rows for a day with no buckets", () => {
    expect(appActivityRows(makeDay(), projects).rows).toHaveLength(0);
  });

  it("flattens multiple hours into separate rows", () => {
    const day = makeDay({
      buckets: [
        {
          hourStart: "2026-09-18T09:00:00.000Z",
          items: [{ projectId: null, appName: "A", secondsSpent: 60, sessionCount: 1 }],
        },
        {
          hourStart: "2026-09-18T10:00:00.000Z",
          items: [{ projectId: null, appName: "B", secondsSpent: 60, sessionCount: 1 }],
        },
      ],
    });

    expect(appActivityRows(day, projects).rows).toHaveLength(2);
  });
});

describe("appActivityRows with Projects off", () => {
  it("has no Project column, so nothing reads as No project", () => {
    const day = makeDay({
      buckets: [
        {
          hourStart: "2026-09-18T09:00:00.000Z",
          items: [{ projectId: null, appName: "Code Editor", secondsSpent: 60, sessionCount: 1 }],
        },
      ],
    });
    const { header, rows } = appActivityRows(day, projects, false);

    expect(header).toEqual(["Hour", "App", "Time spent", "Sessions"]);
    expect(rows[0]).not.toContain("No project");
    expect(rows[0]).toHaveLength(4);
  });
});
