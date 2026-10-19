import { buildCsv, buildTablePdf, formatDuration } from './report-file.util';

/** What the Manual time edits file needs of one edit; the report service's row satisfies it. */
export interface ManualTimeEditFileRow {
  action: 'add' | 'edit' | 'delete';
  memberName: string | null;
  memberEmail: string | null;
  projectName: string | null;
  taskName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  changeSeconds: number;
  reason: string | null;
  changedByName: string | null;
  changedAt: string;
}

export interface ManualTimeEditsTable {
  header: string[];
  body: string[][];
}

const HEADER = [
  'Member',
  'Project / Work order',
  'To-do / Job',
  'Action',
  'Timespan',
  'Time change',
  'Reason',
  'Changed by',
  'Changed at',
];

const ACTION_LABELS = { add: 'Add', edit: 'Edit', delete: 'Delete' };

function day(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    month: 'short',
    day: 'numeric',
  }).format(instant);
}

function time(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

function timespan(
  startedAt: string | null,
  endedAt: string | null,
  zone: string,
): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt);
  const end = endedAt ? time(new Date(endedAt), zone) : 'In progress';
  return `${day(start, zone)}, ${time(start, zone)} - ${end}`;
}

function timeChange(seconds: number): string {
  const elapsed = formatDuration(Math.abs(seconds));
  if (seconds > 0) return `+${elapsed}`;
  if (seconds < 0) return `-${elapsed}`;
  return elapsed;
}

/** The Manual time edits report as a flat table, one row per edit, in the order given. */
export function buildManualTimeEditsTable(
  edits: ManualTimeEditFileRow[],
  zone: string,
  /** Off for an Organisation without Projects: no project column. */
  includeProject = true,
): ManualTimeEditsTable {
  return {
    header: includeProject
      ? HEADER
      : HEADER.filter((name) => name !== 'Project / Work order'),
    body: edits.map((edit) => {
      const changedAt = new Date(edit.changedAt);
      return [
        edit.memberName ?? edit.memberEmail ?? '-',
        ...(includeProject ? [edit.projectName ?? '-'] : []),
        edit.taskName ?? '-',
        ACTION_LABELS[edit.action],
        timespan(edit.startedAt, edit.endedAt, zone),
        timeChange(edit.changeSeconds),
        edit.reason ?? '-',
        edit.changedByName ?? '-',
        `${day(changedAt, zone)}, ${time(changedAt, zone)}`,
      ];
    }),
  };
}

export function buildManualTimeEditsCsv(table: ManualTimeEditsTable): string {
  return buildCsv(table.header, table.body);
}

export function buildManualTimeEditsPdf(
  title: string,
  table: ManualTimeEditsTable,
): Buffer {
  return buildTablePdf(title, table.header, table.body, 8);
}
