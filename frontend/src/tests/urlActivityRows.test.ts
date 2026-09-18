import { describe, expect, it } from "vitest";
import { urlActivityRows } from "@/lib/urlActivityRows";
import type { UrlActivityDay } from "@/types/urlSession";

const projects = [{ id: "p-1", name: "Website" }];

function makeDay(overrides: Partial<UrlActivityDay> = {}): UrlActivityDay {
  return {
    date: "2026-09-18",
    totalActiveMs: 0,
    buckets: [],
    ...overrides,
  };
}

describe("urlActivityRows", () => {
  it("writes the expected header", () => {
    expect(urlActivityRows(makeDay(), projects).header).toEqual([
      "Hour",
      "Project",
      "URL",
      "Title",
      "Time spent",
      "Sessions",
    ]);
  });

  it("writes one row per page item, resolving its project name", () => {
    const day = makeDay({
      buckets: [
        {
          hourStart: "2026-09-18T09:00:00.000Z",
          pages: [
            {
              projectId: "p-1",
              url: "https://example.com/docs",
              host: "example.com",
              title: "Docs",
              activeMs: 3_600_000,
              sessionCount: 2,
            },
          ],
        },
      ],
    });

    const { rows } = urlActivityRows(day, projects);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("Website");
    expect(rows[0]).toContain("https://example.com/docs");
    expect(rows[0]).toContain("Docs");
    expect(rows[0]).toContain("01:00:00");
  });

  it("resolves a null projectId to 'Untracked' and a null title to an empty string", () => {
    const day = makeDay({
      buckets: [
        {
          hourStart: "2026-09-18T09:00:00.000Z",
          pages: [
            {
              projectId: null,
              url: "https://example.com",
              host: "example.com",
              title: null,
              activeMs: 1000,
              sessionCount: 1,
            },
          ],
        },
      ],
    });

    const { rows } = urlActivityRows(day, projects);
    expect(rows[0]).toContain("Untracked");
    expect(rows[0]).toContain("");
  });

  it("returns no rows for a day with no buckets", () => {
    expect(urlActivityRows(makeDay(), projects).rows).toHaveLength(0);
  });
});
