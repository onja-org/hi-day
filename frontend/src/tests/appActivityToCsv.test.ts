import { describe, expect, it } from "vitest";
import { appActivityToCsv } from "@/lib/appActivityToCsv";
import type { AppActivityDay } from "@/types/appActivity";

describe("appActivityToCsv", () => {
  it("renders appActivityRows' header and rows as CSV text", () => {
    const day: AppActivityDay = {
      date: "2026-09-18",
      totalSecondsSpent: 3600,
      buckets: [
        {
          hourStart: "2026-09-18T09:00:00.000Z",
          items: [
            { projectId: "p-1", appName: "Code Editor", secondsSpent: 3600, sessionCount: 4 },
          ],
        },
      ],
    };

    const csv = appActivityToCsv(day, [{ id: "p-1", name: "Website" }]);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("Hour,Project,App,Time spent,Sessions");
    expect(lines[1]).toContain("Website");
    expect(lines[1]).toContain("Code Editor");
  });

  it("returns just the header row for a day with no buckets", () => {
    const day: AppActivityDay = { date: "2026-09-18", totalSecondsSpent: 0, buckets: [] };
    expect(appActivityToCsv(day, []).split("\n")).toHaveLength(1);
  });
});
