import { PROJECT_WORK_ORDER_LABEL } from "@/lib/reportColumnLabels";
import type { ReportTableColumn } from "@/types/reportTable";
import type { AppsUrlsGrouping } from "@/types/appsUrlsReport";

export const APPS_URLS_GROUPINGS: { value: AppsUrlsGrouping; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "project", label: PROJECT_WORK_ORDER_LABEL },
  { value: "app", label: "App or site" },
];

/** The longest range fetched: each day is a request for apps and one for URLs. */
export const APPS_URLS_MAX_DAYS = 31;

/** The grouping names the first column, so its own detail column is left out of the rest. */
export function appsUrlsColumns(grouping: AppsUrlsGrouping): ReportTableColumn[] {
  const label = (value: AppsUrlsGrouping) => APPS_URLS_GROUPINGS.find((option) => option.value === value)!.label;
  return [
    { key: "group", header: label(grouping) },
    ...APPS_URLS_GROUPINGS.filter((option) => option.value !== grouping).map((option) => ({
      key: option.value,
      header: option.label,
    })),
    { key: "time", header: "Time spent (hrs)" },
    { key: "percent", header: "Percent used" },
  ];
}
