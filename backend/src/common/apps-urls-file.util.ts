import { buildCsv, buildTablePdf, formatDuration } from './report-file.util';

/** One app or website's time in one project on one day. */
export interface AppsUrlsItem {
  /** The day, "2026-10-05". */
  dateKey: string;
  projectName: string;
  memberName: string;
  /** App name, or the site's host. */
  label: string;
  seconds: number;
}

export type AppsUrlsGrouping = 'day' | 'project' | 'member';

export interface AppsUrlsTable {
  header: string[];
  body: string[][];
}

type Dimension = 'day' | 'project' | 'member' | 'app';

const DIMENSION_LABELS: Record<Dimension, string> = {
  day: 'Date',
  project: 'Project / Work order',
  member: 'Member',
  app: 'App or site',
};
const DIMENSIONS: Dimension[] = ['day', 'project', 'member', 'app'];

function formatDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function valueOf(item: AppsUrlsItem, dimension: Dimension): string {
  switch (dimension) {
    case 'day':
      return item.dateKey;
    case 'project':
      return item.projectName;
    case 'member':
      return item.memberName;
    case 'app':
      return item.label;
  }
}

/**
 * The Apps & URLs report as a flat table: the chosen grouping first, then
 * the other columns, then time spent and each row's share of its group's
 * time. Rows with the same date, project and app or site are summed, and
 * ordered by group, then by time spent.
 */
export function buildAppsUrlsTable(
  items: AppsUrlsItem[],
  grouping: AppsUrlsGrouping,
): AppsUrlsTable {
  const columns = [grouping, ...DIMENSIONS.filter((d) => d !== grouping)];

  const merged = new Map<string, { item: AppsUrlsItem; seconds: number }>();
  for (const item of items) {
    const key = [
      item.dateKey,
      item.projectName,
      item.memberName,
      item.label,
    ].join('\u0000');
    const existing = merged.get(key);
    if (existing) existing.seconds += item.seconds;
    else merged.set(key, { item, seconds: item.seconds });
  }

  const groupTotals = new Map<string, number>();
  for (const { item, seconds } of merged.values()) {
    const group = valueOf(item, grouping);
    groupTotals.set(group, (groupTotals.get(group) ?? 0) + seconds);
  }

  const body = [...merged.values()]
    .sort(
      (a, b) =>
        valueOf(a.item, grouping).localeCompare(valueOf(b.item, grouping)) ||
        b.seconds - a.seconds,
    )
    .map(({ item, seconds }) => {
      const total = groupTotals.get(valueOf(item, grouping)) ?? 0;
      return [
        ...columns.map((dimension) => {
          const value = valueOf(item, dimension);
          return dimension === 'day' ? formatDay(value) : value;
        }),
        formatDuration(Math.round(seconds)),
        total > 0 ? `${Math.round((seconds / total) * 100)}%` : '-',
      ];
    });

  return {
    header: [
      ...columns.map((dimension) => DIMENSION_LABELS[dimension]),
      'Time spent (hrs)',
      'Percent used',
    ],
    body,
  };
}

export function buildAppsUrlsCsv(table: AppsUrlsTable): string {
  return buildCsv(table.header, table.body);
}

export function buildAppsUrlsPdf(title: string, table: AppsUrlsTable): Buffer {
  return buildTablePdf(title, table.header, table.body, 8);
}
