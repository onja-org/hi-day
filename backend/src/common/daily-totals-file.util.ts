import { addDaysToKey, zonedParts } from './zoned-time.util';
import {
  buildCsv,
  buildTablePdf,
  formatDuration,
  type ReportEntry,
} from './report-file.util';

type DailyTotalsEntry = Pick<
  ReportEntry,
  'startedAt' | 'projectName' | 'durationSeconds'
> & { projectId: string | null };

export interface DailyTotalsTable {
  header: string[];
  /** One row per project, then the "Daily total" row. */
  body: string[][];
}

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

function formatHours(seconds: number): string {
  return seconds <= 0 ? '-' : formatDuration(seconds);
}

/**
 * The Daily totals report as a table: a project per row and a day per
 * column (the days of `fromKey`..`toKey` on `zone`'s clock), then Total
 * worked, with a final "Daily total" row. Running entries have no duration
 * yet and count for nothing.
 */
export function buildDailyTotalsTable(
  entries: DailyTotalsEntry[],
  fromKey: string,
  toKey: string,
  zone: string,
): DailyTotalsTable {
  const dayKeys: string[] = [];
  for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) {
    dayKeys.push(key);
  }

  const projects = new Map<
    string,
    { name: string; days: Map<string, number> }
  >();
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const key = zonedParts(entry.startedAt, zone).dateKey;
    if (!dayKeys.includes(key)) continue;
    const seconds = entry.durationSeconds ?? 0;
    const projectKey = entry.projectId ?? '';
    const project = projects.get(projectKey) ?? {
      name: entry.projectName ?? 'No project',
      days: new Map<string, number>(),
    };
    project.days.set(key, (project.days.get(key) ?? 0) + seconds);
    projects.set(projectKey, project);
    totals.set(key, (totals.get(key) ?? 0) + seconds);
  }

  const rowFor = (label: string, days: Map<string, number>): string[] => [
    label,
    ...dayKeys.map((key) => formatHours(days.get(key) ?? 0)),
    formatHours([...days.values()].reduce((sum, value) => sum + value, 0)),
  ];

  return {
    header: ['Project / Work order', ...dayKeys.map(formatDay), 'Total worked'],
    body: [
      ...[...projects.values()]
        .filter((project) => [...project.days.values()].some((s) => s > 0))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => rowFor(project.name, project.days)),
      rowFor('Daily total', totals),
    ],
  };
}

export function buildDailyTotalsCsv(table: DailyTotalsTable): string {
  return buildCsv(table.header, table.body);
}

export function buildDailyTotalsPdf(
  title: string,
  table: DailyTotalsTable,
): Buffer {
  return buildTablePdf(title, table.header, table.body, 7);
}
