import { describe, expect, it } from "vitest";
import { urlActivityToCsv } from "@/lib/urlActivityToCsv";
import type { UrlActivityDay } from "@/types/urlSession";

describe("urlActivityToCsv", () => {
  it("renders urlActivityRows' header and rows as CSV text", () => {
    const day: UrlActivityDay = {
      date: "2026-09-18",
      totalActiveMs: 3_600_000,
      buckets: [
        {
          hourStart: "2026-09-18T09:00:00.000Z",
          pages: [
            {
              projectId: "p-1",
              url: "https://example.com/docs",
              host: "example.com",
              urlUnknown: false,
              browser: "chrome",
              title: "Docs",
              activeMs: 3_600_000,
              sessionCount: 2,
            },
          ],
        },
      ],
    };

    const csv = urlActivityToCsv(day, [{ id: "p-1", name: "Website" }]);
    const lines = csv.split("\n");

    expect(lines[0]).toBe("Hour,Project,URL,Title,Time spent,Sessions");
    expect(lines[1]).toContain("https://example.com/docs");
  });

  it("returns just the header row for a day with no buckets", () => {
    const day: UrlActivityDay = { date: "2026-09-18", totalActiveMs: 0, buckets: [] };
    expect(urlActivityToCsv(day, []).split("\n")).toHaveLength(1);
  });
});
