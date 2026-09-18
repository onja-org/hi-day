import { describe, expect, it } from "vitest";
import { appActivityToPdf } from "@/lib/appActivityToPdf";
import type { AppActivityDay } from "@/types/appActivity";

describe("appActivityToPdf", () => {
  it("returns a non-empty PDF blob for a day's app activity", () => {
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

    const blob = appActivityToPdf("App activity", day, [{ id: "p-1", name: "Website" }]);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("still returns a valid blob for a day with no buckets", () => {
    const day: AppActivityDay = { date: "2026-09-18", totalSecondsSpent: 0, buckets: [] };
    const blob = appActivityToPdf("App activity", day, []);

    expect(blob.size).toBeGreaterThan(0);
  });
});
