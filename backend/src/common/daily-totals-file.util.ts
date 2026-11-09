import type { TimeEntryListItem } from '../time-entries/services/time-entries.service';
import { attributeProjectSeconds } from './project-attribution.util';
import { buildCsv, buildTablePdf, formatDuration } from './report-file.util';
import {
  activeIntervals,
  type Interval,
  mergeIntervals,
} from './time-entry-union.util';
import { addDaysToKey, zonedParts } from './zoned-time.util';

type DailyTotalsEntry = Pick<
  TimeEntryListItem,
  | 'id'
  | 'membershipId'
  | 'projectId'
  | 'projectName'
  | 'startedAt'
  | 'endedAt'
  | 'pauses'
  | 'durationSeconds'
>;

/** The row key for entries with no Project. */
const NO_PROJECT = '';

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

function lengthMs(intervals: Interval[]): number {
  return intervals.reduce((sum, { start, end }) => sum + (end - start), 0);
}

function coveredMs(intervals: Interval[]): number {
  return lengthMs(mergeIntervals(intervals));
}

/**
 * One person's seconds for one day, per Project (`NO_PROJECT` for entries
 * with none), counting wall-clock time once however many Devices tracked
 * it (ADR-0022).
 *
 * When nothing overlaps, each entry's own `durationSeconds` is used as is —
 * the figure every other view shows — so such a day totals exactly what it
 * always did. When entries do overlap, every shared second is credited to
 * one Project by `attributeProjectSeconds`, and "No project" gets only the
 * time no Project covers, so the rows still add up to the day.
 */
function memberDaySeconds(entries: DailyTotalsEntry[]): Map<string, number> {
  // Only stopped entries reach here, so `endedAt` is always set and the
  // `now` the interval helpers fall back to is never read.
  const intervalsOf = (some: DailyTotalsEntry[]): Interval[] =>
    some.flatMap((entry) =>
      activeIntervals(entry, entry.pauses, entry.endedAt ?? entry.startedAt),
    );
  const all = intervalsOf(entries);
  const seconds = new Map<string, number>();

  if (lengthMs(all) <= coveredMs(all)) {
    for (const entry of entries) {
      const key = entry.projectId ?? NO_PROJECT;
      seconds.set(key, (seconds.get(key) ?? 0) + (entry.durationSeconds ?? 0));
    }
    return seconds;
  }

  const attributed = attributeProjectSeconds(
    entries,
    new Map(entries.map((entry) => [entry.id, entry.pauses])),
    new Date(0),
  );
  for (const [projectId, value] of attributed) seconds.set(projectId, value);
  const withProject = entries.filter((entry) => entry.projectId !== null);
  const projectlessMs = coveredMs(all) - coveredMs(intervalsOf(withProject));
  if (projectlessMs > 0) {
    seconds.set(NO_PROJECT, Math.round(projectlessMs / 1000));
  }
  return seconds;
}

/**
 * The Daily totals report as a table: a project per row and a day per
 * column (the days of `fromKey`..`toKey` on `zone`'s clock), then Total
 * worked, with a final "Daily total" row. Running entries have no duration
 * yet and count for nothing.
 *
 * Each person's day is unioned on its own and the people then added: two
 * Devices tracking 09:00-10:00 is one hour, two people doing so is two.
 * Entries belong to the day they started, as on the timesheet.
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

  const names = new Map<string, string>();
  const memberDays = new Map<
    string,
    { dateKey: string; entries: DailyTotalsEntry[] }
  >();
  for (const entry of entries) {
    if (entry.durationSeconds === null) continue;
    const dateKey = zonedParts(entry.startedAt, zone).dateKey;
    if (!dayKeys.includes(dateKey)) continue;
    const projectKey = entry.projectId ?? NO_PROJECT;
    if (!names.has(projectKey)) {
      names.set(projectKey, entry.projectName ?? 'No project');
    }
    const groupKey = `${entry.membershipId}|${dateKey}`;
    const group = memberDays.get(groupKey) ?? { dateKey, entries: [] };
    group.entries.push(entry);
    memberDays.set(groupKey, group);
  }

  const projects = new Map<
    string,
    { name: string; days: Map<string, number> }
  >();
  const totals = new Map<string, number>();
  for (const { dateKey, entries: dayEntries } of memberDays.values()) {
    for (const [projectKey, seconds] of memberDaySeconds(dayEntries)) {
      const project = projects.get(projectKey) ?? {
        name: names.get(projectKey) ?? 'No project',
        days: new Map<string, number>(),
      };
      project.days.set(dateKey, (project.days.get(dateKey) ?? 0) + seconds);
      projects.set(projectKey, project);
      totals.set(dateKey, (totals.get(dateKey) ?? 0) + seconds);
    }
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
