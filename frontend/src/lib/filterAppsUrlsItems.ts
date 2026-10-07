import type { AppsUrlsItem } from "@/types/appsUrlsReport";

/** Items in the chosen projects (all when none are chosen) whose app, site or project name contains `search`. */
export function filterAppsUrlsItems(items: AppsUrlsItem[], projectIds: string[], search: string): AppsUrlsItem[] {
  const needle = search.trim().toLowerCase();
  return items.filter(
    (item) =>
      (projectIds.length === 0 || (item.projectId !== null && projectIds.includes(item.projectId))) &&
      (needle === "" ||
        item.label.toLowerCase().includes(needle) ||
        item.projectName.toLowerCase().includes(needle)),
  );
}
