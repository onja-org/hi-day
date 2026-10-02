import {
  activeIntervals,
  mergeIntervals,
  type Interval,
} from "@/lib/entryIntervals";
import type { TimeEntryListItem } from "@/types/timeEntry";

type ProjectInterval = Interval & { projectId: string };

/**
 * Worked seconds per Project, with every stretch tracked on more than one
 * Project at once credited to exactly one of them.
 *
 * Two Devices can now run different Projects at the same time (ADR-0022).
 * Unioning each Project's own entries separately would let both claim the
 * shared stretch, so the rows would add up to more than the day they sit
 * in — the double-count moved from the person to the Project rather than
 * removed. Here each overlapping second goes to the Project with more time
 * that day, so the rows sum to exactly the unioned total.
 *
 * Ties go to whichever Project started first, purely so the answer is
 * stable: two Projects with identical totals have no better claim on the
 * second than each other, and a total that reshuffles between renders is
 * worse than an arbitrary but fixed one.
 */
export function attributeProjectSeconds(
  entries: TimeEntryListItem[],
  now: Date | null = null,
): Map<string, number> {
  const intervals: ProjectInterval[] = entries.flatMap((entry) =>
    activeIntervals(entry, now).map((interval) => ({
      ...interval,
      projectId: entry.projectId,
    })),
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
    const [from, to] = [boundaries[i], boundaries[i + 1]];
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
