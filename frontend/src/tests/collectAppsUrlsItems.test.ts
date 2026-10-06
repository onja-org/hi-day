import { describe, expect, it } from "vitest";
import { collectAppsUrlsItems } from "@/lib/collectAppsUrlsItems";
import type { AppActivityDay } from "@/types/appActivity";
import type { UrlActivityDay } from "@/types/urlSession";

const projects = [{ id: "p1", name: "Website" }];

const appDays: AppActivityDay[] = [
  {
    date: "2026-10-05",
    totalSecondsSpent: 90,
    buckets: [
      {
        hourStart: "2026-10-05T09:00:00.000Z",
        items: [
          { projectId: "p1", appName: "Figma", secondsSpent: 60, sessionCount: 1 },
          { projectId: null, appName: "Slack", secondsSpent: 30, sessionCount: 1 },
        ],
      },
    ],
  },
];

const urlDays: UrlActivityDay[] = [
  {
    date: "2026-10-06",
    totalActiveMs: 5000,
    buckets: [
      {
        hourStart: "2026-10-06T09:00:00.000Z",
        pages: [
          { projectId: "p1", url: "https://github.com/a", host: "github.com", title: null, activeMs: 5000, sessionCount: 1 },
        ],
      },
    ],
  },
];

describe("collectAppsUrlsItems", () => {
  it("flattens apps then sites, naming projects and converting site ms to seconds", () => {
    expect(collectAppsUrlsItems(appDays, urlDays, projects)).toEqual([
      { dateKey: "2026-10-05", projectId: "p1", projectName: "Website", label: "Figma", kind: "app", seconds: 60 },
      { dateKey: "2026-10-05", projectId: null, projectName: "Untracked", label: "Slack", kind: "app", seconds: 30 },
      { dateKey: "2026-10-06", projectId: "p1", projectName: "Website", label: "github.com", kind: "site", seconds: 5 },
    ]);
  });

  it("returns nothing for empty days", () => {
    expect(collectAppsUrlsItems([], [], projects)).toEqual([]);
  });
});
