import { describe, expect, it } from "vitest";
import { sumAppSeconds } from "@/lib/sumAppSeconds";
import type { AppHourBucketItem } from "@/types/appActivity";

function item(appName: string, secondsSpent: number, projectId = "p-1"): AppHourBucketItem {
  return { appName, secondsSpent, projectId, sessionCount: 1 };
}

describe("sumAppSeconds", () => {
  it("adds an app's time across hours and projects, busiest first", () => {
    const result = sumAppSeconds({
      date: "2026-10-08",
      totalSecondsSpent: 0,
      buckets: [
        { hourStart: "2026-10-08T09:00:00Z", items: [item("Slack", 300), item("Code", 1200)] },
        { hourStart: "2026-10-08T10:00:00Z", items: [item("Slack", 900, "p-2"), item("Code", 600)] },
      ],
    });

    expect(result).toEqual([
      { appName: "Code", seconds: 1800 },
      { appName: "Slack", seconds: 1200 },
    ]);
  });

  it("orders ties by name so the list doesn't reshuffle between polls", () => {
    const result = sumAppSeconds({
      date: "2026-10-08",
      totalSecondsSpent: 0,
      buckets: [{ hourStart: "2026-10-08T09:00:00Z", items: [item("Zoom", 60), item("Arc", 60)] }],
    });

    expect(result.map((app) => app.appName)).toEqual(["Arc", "Zoom"]);
  });

  it("is empty for a day with no samples", () => {
    expect(sumAppSeconds({ date: "2026-10-08", totalSecondsSpent: 0, buckets: [] })).toEqual([]);
  });
});
