import { projectNameOrUntracked } from "@/lib/projectNameOrUntracked";
import { unknownWebsiteLabel } from "@/lib/unknownWebsiteLabel";
import type { AppActivityDay } from "@/types/appActivity";
import type { AppsUrlsItem, AppsUrlsMemberDay } from "@/types/appsUrlsReport";
import type { Project } from "@/types/project";
import type { UrlActivityDay } from "@/types/urlSession";

/** Flattens the per-day app and URL summaries (hour buckets and all) into one list of items. */
export function collectAppsUrlsItems(
  appDays: AppsUrlsMemberDay<AppActivityDay>[],
  urlDays: AppsUrlsMemberDay<UrlActivityDay>[],
  projects: Pick<Project, "id" | "name">[],
): AppsUrlsItem[] {
  const apps = appDays.flatMap(({ member, day }) =>
    day.buckets.flatMap((bucket) =>
      bucket.items.map(
        (item): AppsUrlsItem => ({
          dateKey: day.date,
          projectId: item.projectId,
          projectName: projectNameOrUntracked(projects, item.projectId),
          label: item.appName,
          kind: "app",
          seconds: item.secondsSpent,
          memberId: member.key,
          memberName: member.name,
        }),
      ),
    ),
  );
  const sites = urlDays.flatMap(({ member, day }) =>
    day.buckets.flatMap((bucket) =>
      bucket.pages.map(
        (page): AppsUrlsItem => ({
          dateKey: day.date,
          projectId: page.projectId,
          projectName: projectNameOrUntracked(projects, page.projectId),
          label: page.urlUnknown ? unknownWebsiteLabel(page.browser) : page.host,
          kind: "site",
          seconds: page.activeMs / 1000,
          memberId: member.key,
          memberName: member.name,
        }),
      ),
    ),
  );
  return [...apps, ...sites];
}
