import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { addDaysToKey, zonedParts } from './zoned-time.util';
import type { ReportEntry } from './report-file.util';

type DailyTotalsEntry = Pick<
  ReportEntry,
  'startedAt' | 'projectName' | 'durationSeconds'
> & { projectId: string };

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
  if (seconds <= 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
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
    const project = projects.get(entry.projectId) ?? {
      name: entry.projectName,
      days: new Map<string, number>(),
    };
    project.days.set(key, (project.days.get(key) ?? 0) + seconds);
    projects.set(entry.projectId, project);
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

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildDailyTotalsCsv(table: DailyTotalsTable): string {
  return [table.header, ...table.body]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

export function buildDailyTotalsPdf(
  title: string,
  table: DailyTotalsTable,
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  autoTable(doc, {
    head: [table.header],
    body: table.body,
    startY: 20,
    styles: { fontSize: 7 },
  });
  return Buffer.from(doc.output('arraybuffer'));
}
