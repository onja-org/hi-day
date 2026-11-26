import {
  type DailyTotalsEntry,
  memberDaySeconds,
  NO_PROJECT,
} from '../common/daily-totals-file.util';
import { zonedParts } from '../common/zoned-time.util';
import type { TimeEntryListItem } from '../time-entries/services/time-entries.service';
import { dayKeysOf, type DayRange } from './summary-period.util';

export type SummaryStatsEntry = DailyTotalsEntry &
  Pick<TimeEntryListItem, 'activePercentage' | 'activityCoveredSeconds'>;

export interface SummaryProjectTime {
  /** `null` for time with no Project. */
  projectId: string | null;
  name: string;
  seconds: number;
}

/** One person's time over one period. */
export interface MemberPeriodStats {
  totalSeconds: number;
  /** Every day of the period, zero-filled. */
  byDay: { dateKey: string; seconds: number }[];
  /** Most time first. */
  byProject: SummaryProjectTime[];
  /** Keyboard/mouse activity, 0–100, weighted by how long each entry was
   * measured; `null` when nothing was. */
  activityPercentage: number | null;
}

/**
 * One person's totals for the days of `range` — built from the same
 * per-day union the Daily totals report uses, so a summary never disagrees
 * with the report for the same days: time tracked on two Devices at once
 * counts once, entries belong to the day they started, and a still-running
 * entry counts for nothing yet.
 */
export function memberPeriodStats(
  entries: SummaryStatsEntry[],
  range: DayRange,
  zone: string,
): MemberPeriodStats {
  const dayKeys = dayKeysOf(range);
  const byDayEntries = new Map<string, SummaryStatsEntry[]>(
    dayKeys.map((key) => [key, []]),
  );
  const projectNames = new Map<string, string>();

  for (const entry of entries) {
    if (entry.durationSeconds === null) continue;
    const dateKey = zonedParts(entry.startedAt, zone).dateKey;
    const day = byDayEntries.get(dateKey);
    if (!day) continue;
    day.push(entry);
    const projectKey = entry.projectId ?? NO_PROJECT;
    if (!projectNames.has(projectKey)) {
      projectNames.set(projectKey, entry.projectName ?? 'No project');
    }
  }

  const projectSeconds = new Map<string, number>();
  const byDay = dayKeys.map((dateKey) => {
    let seconds = 0;
    for (const [projectKey, value] of memberDaySeconds(
      byDayEntries.get(dateKey) ?? [],
    )) {
      seconds += value;
      projectSeconds.set(
        projectKey,
        (projectSeconds.get(projectKey) ?? 0) + value,
      );
    }
    return { dateKey, seconds };
  });

  let weighted = 0;
  let covered = 0;
  for (const day of byDayEntries.values()) {
    for (const entry of day) {
      const measured = entry.activityCoveredSeconds ?? 0;
      if (entry.activePercentage === null || measured <= 0) continue;
      weighted += entry.activePercentage * measured;
      covered += measured;
    }
  }

  return {
    totalSeconds: byDay.reduce((sum, day) => sum + day.seconds, 0),
    byDay,
    byProject: [...projectSeconds.entries()]
      .filter(([, seconds]) => seconds > 0)
      .map(([projectKey, seconds]) => ({
        projectId: projectKey === NO_PROJECT ? null : projectKey,
        name: projectNames.get(projectKey) ?? 'No project',
        seconds,
      }))
      .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name)),
    activityPercentage: covered > 0 ? Math.round(weighted / covered) : null,
  };
}
