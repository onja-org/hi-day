import { formatElapsed } from "@/lib/formatElapsed";
import { formatReportDay } from "@/lib/formatReportDay";
import type { AppsUrlsGrouping, AppsUrlsItem } from "@/types/appsUrlsReport";
import type { ReportTableRow } from "@/types/reportTable";

type Part = { id: string; label: string };

function partOf(item: AppsUrlsItem, dimension: AppsUrlsGrouping): Part {
  switch (dimension) {
    case "date":
      return { id: item.dateKey, label: formatReportDay(item.dateKey) };
    case "project":
      return { id: item.projectId ?? "untracked", label: item.projectName };
    case "app":
      return { id: `${item.kind}|${item.label}`, label: item.label };
  }
}

const DIMENSIONS: AppsUrlsGrouping[] = ["date", "project", "app"];

function totalOf(items: AppsUrlsItem[]): number {
  return items.reduce((sum, item) => sum + item.seconds, 0);
}

function percent(seconds: number, total: number): string {
  return total > 0 ? `${Math.round((seconds / total) * 100)}%` : "-";
}

/**
 * One group row per date / project / app, each opening onto its other
 * dimensions (e.g. a date → project + app rows). A row's percent is its
 * share of the group's time; the group row itself shows no percent.
 */
export function buildAppsUrlsRows(items: AppsUrlsItem[], grouping: AppsUrlsGrouping): ReportTableRow[] {
  const groups = new Map<string, { label: string; items: AppsUrlsItem[] }>();
  for (const item of items) {
    const { id, label } = partOf(item, grouping);
    const group = groups.get(id) ?? { label, items: [] };
    group.items.push(item);
    groups.set(id, group);
  }

  const detail = DIMENSIONS.filter((dimension) => dimension !== grouping);

  return [...groups.entries()].map(([groupId, group]) => {
    const groupTotal = totalOf(group.items);
    const merged = new Map<string, { cells: Record<string, string>; seconds: number }>();
    for (const item of group.items) {
      const parts = detail.map((dimension) => ({ dimension, ...partOf(item, dimension) }));
      const key = parts.map((part) => part.id).join("|");
      const existing = merged.get(key);
      if (existing) existing.seconds += item.seconds;
      else
        merged.set(key, {
          cells: Object.fromEntries(parts.map((part) => [part.dimension, part.label])),
          seconds: item.seconds,
        });
    }

    return {
      id: groupId,
      sortKey: grouping === "date" ? groupId : group.label,
      cells: { group: group.label, time: formatElapsed(groupTotal * 1000) },
      subRows: [...merged.entries()]
        .sort(([, a], [, b]) => b.seconds - a.seconds)
        .map(([key, row]) => ({
          id: `${groupId}|${key}`,
          sortKey: -row.seconds,
          cells: {
            ...row.cells,
            time: formatElapsed(row.seconds * 1000),
            percent: percent(row.seconds, groupTotal),
          },
        })),
    };
  });
}
