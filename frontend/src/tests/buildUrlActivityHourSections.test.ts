import { describe, expect, it } from "vitest";
import { buildUrlActivityHourSections } from "@/lib/buildUrlActivityHourSections";
import type { UrlHourBucketPage } from "@/types/urlSession";

function page(overrides: Partial<UrlHourBucketPage> = {}): UrlHourBucketPage {
  return {
    projectId: "p-1",
    url: "https://github.com/onja-org/repo",
    host: "github.com",
    urlUnknown: false,
    browser: "chrome",
    title: "repo",
    activeMs: 1_000,
    sessionCount: 1,
    ...overrides,
  };
}

const HOUR = "2026-09-18T09:00:00.000Z";

describe("buildUrlActivityHourSections", () => {
  it("returns one section per domain when every page shares a project", () => {
    const sections = buildUrlActivityHourSections(
      [page({ url: "https://github.com/a" }), page({ url: "https://youtube.com/watch", host: "youtube.com" })],
      HOUR,
    );

    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.domain.domain).sort()).toEqual(["github.com", "youtube.com"]);
    expect(sections.every((s) => s.projectId === "p-1")).toBe(true);
  });

  it("splits the same domain into separate sections when visited under different projects", () => {
    const sections = buildUrlActivityHourSections(
      [
        page({ projectId: "p-1", url: "https://github.com/a" }),
        page({ projectId: "p-2", url: "https://github.com/b" }),
      ],
      HOUR,
    );

    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.projectId).sort()).toEqual(["p-1", "p-2"]);
    expect(sections.every((s) => s.domain.domain === "github.com")).toBe(true);
  });

  it("groups a null projectId under its own untracked section", () => {
    const sections = buildUrlActivityHourSections(
      [page({ projectId: null, url: "https://github.com/a" })],
      HOUR,
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].projectId).toBeNull();
    expect(sections[0].key).toBe("untracked|github.com");
  });

  it("returns no sections for an empty page list", () => {
    expect(buildUrlActivityHourSections([], HOUR)).toHaveLength(0);
  });
});
