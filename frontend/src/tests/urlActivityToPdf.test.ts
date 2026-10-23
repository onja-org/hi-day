import { describe, expect, it } from "vitest";
import { urlActivityToPdf } from "@/lib/urlActivityToPdf";
import type { UrlActivityDay } from "@/types/urlSession";

describe("urlActivityToPdf", () => {
  it("returns a non-empty PDF blob for a day's website activity", () => {
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

    const blob = urlActivityToPdf("Website activity", day, [{ id: "p-1", name: "Website" }]);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("still returns a valid blob for a day with no buckets", () => {
    const day: UrlActivityDay = { date: "2026-09-18", totalActiveMs: 0, buckets: [] };
    const blob = urlActivityToPdf("Website activity", day, []);

    expect(blob.size).toBeGreaterThan(0);
  });
});
