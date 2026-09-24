import { unionActiveSeconds } from "@/lib/unionActiveSeconds";
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
  const entriesByCell = new Map<string, TimeEntryListItem[]>();
  const entriesByProject = new Map<string, TimeEntryListItem[]>();
  const entriesByDay: TimeEntryListItem[][] = Array.from(
    { length: DAYS_PER_WEEK },
    () => [],
  );
  const allEntries: TimeEntryListItem[] = [];

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

    const cellKey = `${entry.projectId}|${dayIndex}`;
    entriesByCell.set(cellKey, [...(entriesByCell.get(cellKey) ?? []), entry]);
    entriesByProject.set(entry.projectId, [
      ...(entriesByProject.get(entry.projectId) ?? []),
      entry,
    ]);
    entriesByDay[dayIndex].push(entry);
    allEntries.push(entry);
  }

  // Every total here is a union, not a sum. A person tracking the same hour
  // on two Devices worked one hour, and adding the rows would report two
  // (ADR-0021). Each is unioned within its own scope — cell, column, and the
  // grand total across the week — because overlaps only cancel within a
  // scope, so the grand total is not the sum of the columns either.
  for (const row of rowsByProject.values()) {
    for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
      row.dailySeconds[day] = unionActiveSeconds(
        entriesByCell.get(`${row.projectId}|${day}`) ?? [],
      );
    }
    row.totalSeconds = unionActiveSeconds(entriesByProject.get(row.projectId) ?? []);
  }
  for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
    dailyTotals[day] = unionActiveSeconds(entriesByDay[day]);
  }

  return {
    rows: [...rowsByProject.values()],
    dailyTotals,
    grandTotal: unionActiveSeconds(allEntries),
  };
}
