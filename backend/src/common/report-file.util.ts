import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { TimeEntryListItem } from '../time-entries/services/time-entries.service';

export type ReportEntry = Pick<
  TimeEntryListItem,
  | 'startedAt'
  | 'endedAt'
  | 'projectName'
  | 'taskName'
  | 'memberName'
  | 'memberEmail'
  | 'durationSeconds'
  | 'pausedSeconds'
  | 'source'
>;

const HEADER = [
  'Date',
  'Member',
  'Project',
  'Task',
  'Start',
  'End',
  'Duration',
  'Paused (min)',
  'Source',
  'Time zone',
];

function formatDate(date: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function formatTime(date: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

/** One text row per entry, read on the organisation's clock. */
/** The header, without its Project column when the Organisation has Projects off. */
export function reportHeader(includeProject = true): string[] {
  return includeProject ? HEADER : HEADER.filter((name) => name !== 'Project');
}

export function reportRows(
  entries: ReportEntry[],
  zone: string,
  includeProject = true,
): string[][] {
  return entries.map((entry) => [
    formatDate(entry.startedAt, zone),
    entry.memberName ?? entry.memberEmail ?? '',
    ...(includeProject ? [entry.projectName ?? ''] : []),
    entry.taskName ?? '',
    formatTime(entry.startedAt, zone),
    entry.endedAt ? formatTime(entry.endedAt, zone) : 'In progress',
    formatDuration(entry.durationSeconds),
    String(Math.round(entry.pausedSeconds / 60)),
    entry.source,
    zone,
  ]);
}

/**
 * A cell as CSV. Names and tasks are typed by members, so a value a
 * spreadsheet would run as a formula (`=…`, `+…`, `-…`, `@…`) is prefixed
 * with an apostrophe, which makes Excel and Sheets show it as plain text.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A header and rows as CSV text, one `csvCell`-escaped line per row. */
export function buildCsv(header: string[], rows: string[][]): string {
  return [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

/** A landscape PDF: `title` above a table of `header` and `rows`. */
export function buildTablePdf(
  title: string,
  header: string[],
  rows: string[][],
  fontSize: number,
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  autoTable(doc, {
    head: [header],
    body: rows,
    startY: 20,
    styles: { fontSize },
  });
  return Buffer.from(doc.output('arraybuffer'));
}

export function buildReportCsv(
  entries: ReportEntry[],
  zone: string,
  includeProject = true,
): string {
  return buildCsv(
    reportHeader(includeProject),
    reportRows(entries, zone, includeProject),
  );
}

export function buildReportPdf(
  title: string,
  entries: ReportEntry[],
  zone: string,
  includeProject = true,
): Buffer {
  return buildTablePdf(
    title,
    reportHeader(includeProject),
    reportRows(entries, zone, includeProject),
    8,
  );
}
