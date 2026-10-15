import type { AppsUrlsItem } from "@/types/appsUrlsReport";

/**
 * Items in the chosen projects (all when none are chosen) whose app, site or
 * project name contains `search`. With Projects off the project name is not
 * searched: it is only ever "No project", and matching it would make a search
 * for "no" or "project" keep every row.
 */
export function filterAppsUrlsItems(
  items: AppsUrlsItem[],
  projectIds: string[],
  search: string,
  projectsEnabled = true,
): AppsUrlsItem[] {
  const needle = search.trim().toLowerCase();
  return items.filter(
    (item) =>
      (projectIds.length === 0 || (item.projectId !== null && projectIds.includes(item.projectId))) &&
      (needle === "" ||
        item.label.toLowerCase().includes(needle) ||
        (projectsEnabled && item.projectName.toLowerCase().includes(needle))),
  );
}
