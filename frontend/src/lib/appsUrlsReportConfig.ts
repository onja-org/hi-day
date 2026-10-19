import { PROJECT_WORK_ORDER_LABEL } from "@/lib/reportColumnLabels";
import type { ReportTableColumn } from "@/types/reportTable";
import type { AppsUrlsDimension, AppsUrlsGrouping } from "@/types/appsUrlsReport";

export const APPS_URLS_GROUPINGS: { value: AppsUrlsGrouping; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "project", label: PROJECT_WORK_ORDER_LABEL },
  { value: "member", label: "Member" },
];

/** Column order for the details under a group; the app or site is never a grouping. */
export const APPS_URLS_DIMENSIONS: { value: AppsUrlsDimension; label: string }[] = [
  ...APPS_URLS_GROUPINGS,
  { value: "app", label: "App or site" },
];

/** Without Projects the report has no project to group by or to show. */
export function appsUrlsGroupings(projectsEnabled: boolean): typeof APPS_URLS_GROUPINGS {
  return projectsEnabled ? APPS_URLS_GROUPINGS : APPS_URLS_GROUPINGS.filter((option) => option.value !== "project");
}

export function appsUrlsDimensions(projectsEnabled: boolean): typeof APPS_URLS_DIMENSIONS {
  return projectsEnabled ? APPS_URLS_DIMENSIONS : APPS_URLS_DIMENSIONS.filter((option) => option.value !== "project");
}

/** The longest range fetched: each day is a request for apps and one for URLs. */
export const APPS_URLS_MAX_DAYS = 31;

/** Most member-days fetched at once on the All tab, which asks for every member's every day. */
export const APPS_URLS_MAX_MEMBER_DAYS = 200;

/** The grouping names the first column, so its own detail column is left out of the rest. */
export function appsUrlsColumns(grouping: AppsUrlsGrouping, projectsEnabled = true): ReportTableColumn[] {
  const dimensions = appsUrlsDimensions(projectsEnabled);
  const label = APPS_URLS_DIMENSIONS.find((option) => option.value === grouping)!.label;
  return [
    { key: "group", header: label },
    ...dimensions.filter((option) => option.value !== grouping).map((option) => ({
      key: option.value,
      header: option.label,
    })),
    { key: "time", header: "Time spent (hrs)" },
    { key: "percent", header: "Percent used" },
  ];
}
