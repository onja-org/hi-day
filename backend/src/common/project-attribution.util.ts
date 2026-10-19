import { TimeEntry } from '../database/entities/time-entry.entity';
import { TimeEntryPause } from '../database/entities/time-entry-pause.entity';
import {
  activeIntervals,
  mergeIntervals,
  Interval,
} from './time-entry-union.util';

interface ProjectInterval extends Interval {
  projectId: string;
}

/**
 * Worked seconds per Project, with every stretch tracked on more than one
 * Project at once credited to exactly one of them.
 *
 * Two Devices can run different Projects at the same time (ADR-0022).
 * Unioning each Project's own entries separately lets both claim the shared
 * stretch, so the per-project figures add up to more than the period they
 * describe — the double-count moved from the person to the Project rather
 * than removed. Here each overlapping second goes to the Project with more
 * time in the period, so the parts sum to the unioned whole.
 *
 * Ties go to whichever Project started first, purely for a stable answer:
 * two Projects with identical totals have no better claim than each other,
 * and a figure that reshuffles between requests is worse than a fixed one.
 *
 * Mirrors the frontend's `attributeProjectSeconds`; the two have to agree or
 * the dashboard and the timesheet quote different hours for the same day.
 */
export function attributeProjectSeconds(
  entries: TimeEntry[],
  pausesByEntry: Map<string, TimeEntryPause[]>,
  now: Date,
): Map<string, number> {
  // An entry with no Project has none to credit, and claiming a stretch for
  // nobody would shrink the figure of a real Project it overlaps.
  const intervals: ProjectInterval[] = entries.flatMap((entry) =>
    entry.projectId === null
      ? []
      : activeIntervals(entry, pausesByEntry.get(entry.id) ?? [], now).map(
          (interval) => ({ ...interval, projectId: entry.projectId as string }),
        ),
  );

  const seconds = new Map<string, number>();
  for (const { projectId } of intervals) {
    seconds.set(projectId, 0);
  }
  if (intervals.length === 0) return seconds;

  const rank = rankProjects(intervals);
  const owner = (at: number): string | undefined =>
    intervals
      .filter((interval) => interval.start <= at && at < interval.end)
      .sort((a, b) => rank.indexOf(a.projectId) - rank.indexOf(b.projectId))[0]
      ?.projectId;

  // Walk the elementary segments between every boundary. Within one segment
  // the set of Projects covering it cannot change, so the highest-ranked of
  // them owns the whole segment.
  const boundaries = [
    ...new Set(intervals.flatMap(({ start, end }) => [start, end])),
  ].sort((a, b) => a - b);

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const from = boundaries[i];
    const to = boundaries[i + 1];
    const projectId = owner(from);
    if (projectId === undefined) continue;
    seconds.set(projectId, (seconds.get(projectId) ?? 0) + (to - from) / 1000);
  }

  for (const [projectId, value] of seconds) {
    seconds.set(projectId, Math.round(value));
  }
  return seconds;
}

/** Projects by their own unioned time, longest first; earliest start breaks a tie. */
function rankProjects(intervals: ProjectInterval[]): string[] {
  const byProject = new Map<string, ProjectInterval[]>();
  for (const interval of intervals) {
    byProject.set(interval.projectId, [
      ...(byProject.get(interval.projectId) ?? []),
      interval,
    ]);
  }

  return [...byProject.entries()]
    .map(([projectId, own]) => ({
      projectId,
      covered: mergeIntervals(own).reduce(
        (total, interval) => total + (interval.end - interval.start),
        0,
      ),
      firstStart: Math.min(...own.map((interval) => interval.start)),
    }))
    .sort((a, b) => b.covered - a.covered || a.firstStart - b.firstStart)
    .map((project) => project.projectId);
}
