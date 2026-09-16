import type { ProjectColour } from "@/types/project";
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

function dayIndexOf(entry: TimeEntryListItem, weekStart: Date): number {
  const entryDayStart = new Date(entry.startedAt);
  const fromUtc = Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  const toUtc = Date.UTC(
    entryDayStart.getFullYear(),
    entryDayStart.getMonth(),
    entryDayStart.getDate(),
  );
  return Math.round((toUtc - fromUtc) / 86_400_000);
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
): ProjectDayMatrix {
  const rowsByProject = new Map<string, ProjectDayMatrixRow>();
  const dailyTotals = new Array<number>(DAYS_PER_WEEK).fill(0);

  for (const entry of entries) {
    if (entry.durationSeconds === null) continue;
    const dayIndex = dayIndexOf(entry, weekStart);
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
