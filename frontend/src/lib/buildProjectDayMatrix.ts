import type { ProjectColour } from "@/types/project";
import { dateKeyInZone, detectTimezone } from "./timezone";
import type { TimeEntryListItem } from "@/types/timeEntry";

export type ProjectDayMatrixRow = {
  projectId: string;
  projectName: string;
  projectColour: ProjectColour;
  dailySeconds: number[];
  totalSeconds: number;
};

export type ProjectDayMatrix = {
  rows: ProjectDayMatrixRow[];
  dailyTotals: number[];
  grandTotal: number;
};

const DAYS_PER_WEEK = 7;

/**
 * Which column of the week an entry belongs in, counted in calendar days of
 * `zone` — not in elapsed hours, which would be off by one across a
 * daylight-saving change, and not in the viewer's own days, which can put
 * the entry in a different column than the Daily view groups it under.
 */
function dayIndexOf(
  entry: TimeEntryListItem,
  weekStart: Date,
  zone: string,
): number {
  const fromKey = dateKeyInZone(weekStart, zone);
  const toKey = dateKeyInZone(entry.startedAt, zone);
  return Math.round(
    (keyAsUtc(toKey) - keyAsUtc(fromKey)) / 86_400_000,
  );
}

/** A date key read as a plain calendar date, so two keys can be subtracted
 * without any zone's offset entering the arithmetic. */
function keyAsUtc(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * Builds a project × day-of-week totals matrix for the Weekly view — one row
 * per project the member worked on that week, zero-filled per day, in the
 * order each project first appears. Only completed entries contribute
 * seconds (a still-running entry has no fixed duration yet), matching
 * `buildDailyTotals`'s convention.
 */
export function buildProjectDayMatrix(
  entries: TimeEntryListItem[],
  weekStart: Date,
  zone: string = detectTimezone(),
): ProjectDayMatrix {
  const rowsByProject = new Map<string, ProjectDayMatrixRow>();
  const dailyTotals = new Array<number>(DAYS_PER_WEEK).fill(0);

  for (const entry of entries) {
    if (entry.durationSeconds === null) continue;
    const dayIndex = dayIndexOf(entry, weekStart, zone);
    if (dayIndex < 0 || dayIndex >= DAYS_PER_WEEK) continue;

    let row = rowsByProject.get(entry.projectId);
    if (!row) {
      row = {
        projectId: entry.projectId,
        projectName: entry.projectName,
        projectColour: entry.projectColour,
        dailySeconds: new Array<number>(DAYS_PER_WEEK).fill(0),
        totalSeconds: 0,
      };
      rowsByProject.set(entry.projectId, row);
    }

    row.dailySeconds[dayIndex] += entry.durationSeconds;
    row.totalSeconds += entry.durationSeconds;
    dailyTotals[dayIndex] += entry.durationSeconds;
  }

  return {
    rows: [...rowsByProject.values()],
    dailyTotals,
    grandTotal: dailyTotals.reduce((sum, seconds) => sum + seconds, 0),
  };
}
