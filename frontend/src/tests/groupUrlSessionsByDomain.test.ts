import { describe, expect, it } from "vitest";
import { groupUrlSessionsByDomain } from "@/lib/groupUrlSessionsByDomain";
import type { UrlSessionGroup } from "@/types/urlSession";

function page(overrides: Partial<UrlSessionGroup> = {}): UrlSessionGroup {
  return {
    url: "https://github.com/onja-org/repo",
    host: "github.com",
    title: "repo",
    totalActiveMs: 1_000,
    lastVisitedAt: "2026-09-10T16:32:00.000Z",
    sessionCount: 1,
    ...overrides,
  };
}

describe("groupUrlSessionsByDomain", () => {
  it("collapses every page on a host into one domain entry", () => {
    const result = groupUrlSessionsByDomain([
      page({ url: "https://github.com/a" }),
      page({ url: "https://github.com/b" }),
      page({ url: "https://youtube.com/watch", host: "youtube.com" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((d) => d.domain).sort()).toEqual(["github.com", "youtube.com"]);
    expect(result.find((d) => d.domain === "github.com")?.pages).toHaveLength(2);
  });

  it("sums focused time across every page on the domain", () => {
    const result = groupUrlSessionsByDomain([
      page({ url: "https://github.com/a", totalActiveMs: 23_000 }),
      page({ url: "https://github.com/b", totalActiveMs: 15_000 }),
    ]);

    expect(result[0].totalActiveMs).toBe(38_000);
  });

  it("treats www. and the bare host as the same domain", () => {
    const result = groupUrlSessionsByDomain([
      page({ url: "https://www.youtube.com/a", host: "www.youtube.com" }),
      page({ url: "https://youtube.com/b", host: "youtube.com" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe("youtube.com");
  });

  it("keeps distinct subdomains apart rather than guessing at a public suffix", () => {
    const result = groupUrlSessionsByDomain([
      page({ url: "https://mail.google.com/x", host: "mail.google.com" }),
      page({ url: "https://docs.google.com/y", host: "docs.google.com" }),
    ]);

    expect(result.map((d) => d.domain).sort()).toEqual([
      "docs.google.com",
      "mail.google.com",
    ]);
  });

  it("orders domains, and pages within them, by most recent visit", () => {
    const result = groupUrlSessionsByDomain([
      page({ url: "https://old.test/a", host: "old.test", lastVisitedAt: "2026-09-10T10:00:00.000Z" }),
      page({ url: "https://new.test/a", host: "new.test", lastVisitedAt: "2026-09-10T12:00:00.000Z" }),
      page({ url: "https://new.test/b", host: "new.test", lastVisitedAt: "2026-09-10T15:00:00.000Z" }),
    ]);

    expect(result.map((d) => d.domain)).toEqual(["new.test", "old.test"]);
    // The domain's own timestamp is its most recent page, not its first.
    expect(result[0].lastVisitedAt).toBe("2026-09-10T15:00:00.000Z");
    expect(result[0].pages.map((p) => p.url)).toEqual([
      "https://new.test/b",
      "https://new.test/a",
    ]);
  });

  it("returns an empty array for no sessions", () => {
    expect(groupUrlSessionsByDomain([])).toEqual([]);
  });
});
