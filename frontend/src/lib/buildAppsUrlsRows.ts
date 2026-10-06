import { formatElapsed } from "@/lib/formatElapsed";
import { formatReportDay } from "@/lib/formatReportDay";
import { APPS_URLS_DIMENSIONS } from "@/lib/appsUrlsReportConfig";
import type { AppsUrlsDimension, AppsUrlsGrouping, AppsUrlsItem } from "@/types/appsUrlsReport";
import type { ReportTableRow } from "@/types/reportTable";

type Part = { id: string; label: string };

function partOf(item: AppsUrlsItem, dimension: AppsUrlsDimension, memberName: string): Part {
  switch (dimension) {
    case "date":
      return { id: item.dateKey, label: formatReportDay(item.dateKey) };
    case "project":
      return { id: item.projectId ?? "untracked", label: item.projectName };
    case "member":
      return { id: "member", label: memberName };
    case "app":
      return { id: `${item.kind}|${item.label}`, label: item.label };
  }
}

function totalOf(items: AppsUrlsItem[]): number {
  return items.reduce((sum, item) => sum + item.seconds, 0);
}

function percent(seconds: number, total: number): string {
  return total > 0 ? `${Math.round((seconds / total) * 100)}%` : "-";
}

/** Blanks every cell but the app or site, so a date / project / member shows once per run of rows. */
function blankedContext(cells: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.keys(cells).filter((key) => key !== "app").map((key) => [key, ""]));
}

/**
 * One group row per date / project / app, each opening onto its other
 * dimensions (e.g. a date → project + app rows). A row's percent is its
 * share of the group's time; the group row itself shows no percent.
 * Sub rows are ordered by their date / project / member, with each shown
 * only on the first row of its run, then by time spent.
 * The activity data is the viewer's own, so every row's member is `memberName`.
 */
export function buildAppsUrlsRows(
  items: AppsUrlsItem[],
  grouping: AppsUrlsGrouping,
  memberName: string,
): ReportTableRow[] {
  const groups = new Map<string, { label: string; items: AppsUrlsItem[] }>();
  for (const item of items) {
    const { id, label } = partOf(item, grouping, memberName);
    const group = groups.get(id) ?? { label, items: [] };
    group.items.push(item);
    groups.set(id, group);
  }

  const detail = APPS_URLS_DIMENSIONS.map((option) => option.value).filter((dimension) => dimension !== grouping);

  return [...groups.entries()].map(([groupId, group]) => {
    const groupTotal = totalOf(group.items);
    const merged = new Map<string, { cells: Record<string, string>; context: string; seconds: number }>();
    for (const item of group.items) {
      const parts = detail.map((dimension) => ({ dimension, ...partOf(item, dimension, memberName) }));
      const key = parts.map((part) => part.id).join("|");
      const existing = merged.get(key);
      if (existing) existing.seconds += item.seconds;
      else
        merged.set(key, {
          cells: Object.fromEntries(parts.map((part) => [part.dimension, part.label])),
          context: parts
            .filter((part) => part.dimension !== "app")
            .map((part) => part.id)
            .join("|"),
          seconds: item.seconds,
        });
    }

    return {
      id: groupId,
      sortKey: grouping === "date" ? groupId : group.label,
      cells: { group: group.label, time: formatElapsed(groupTotal * 1000) },
      subRows: [...merged.entries()]
        .sort(([, a], [, b]) => a.context.localeCompare(b.context) || b.seconds - a.seconds)
        .map(([key, row], index, sorted) => ({
          id: `${groupId}|${key}`,
          sortKey: -row.seconds,
          cells: {
            ...row.cells,
            ...(index > 0 && sorted[index - 1][1].context === row.context ? blankedContext(row.cells) : {}),
            time: formatElapsed(row.seconds * 1000),
            percent: percent(row.seconds, groupTotal),
          },
        })),
    };
  });
}
