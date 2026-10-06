import { projectNameOrUntracked } from "@/lib/projectNameOrUntracked";
import type { AppActivityDay } from "@/types/appActivity";
import type { AppsUrlsItem } from "@/types/appsUrlsReport";
import type { Project } from "@/types/project";
import type { UrlActivityDay } from "@/types/urlSession";

/** Flattens the per-day app and URL summaries (hour buckets and all) into one list of items. */
export function collectAppsUrlsItems(
  appDays: AppActivityDay[],
  urlDays: UrlActivityDay[],
  projects: Pick<Project, "id" | "name">[],
): AppsUrlsItem[] {
  const apps = appDays.flatMap((day) =>
    day.buckets.flatMap((bucket) =>
      bucket.items.map(
        (item): AppsUrlsItem => ({
          dateKey: day.date,
          projectId: item.projectId,
          projectName: projectNameOrUntracked(projects, item.projectId),
          label: item.appName,
          kind: "app",
          seconds: item.secondsSpent,
        }),
      ),
    ),
  );
  const sites = urlDays.flatMap((day) =>
    day.buckets.flatMap((bucket) =>
      bucket.pages.map(
        (page): AppsUrlsItem => ({
          dateKey: day.date,
          projectId: page.projectId,
          projectName: projectNameOrUntracked(projects, page.projectId),
          label: page.host,
          kind: "site",
          seconds: page.activeMs / 1000,
        }),
      ),
    ),
  );
  return [...apps, ...sites];
}
