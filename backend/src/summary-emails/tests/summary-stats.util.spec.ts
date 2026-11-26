import { memberPeriodStats } from '../summary-stats.util';

const entry = (
  startedAt: string,
  durationSeconds: number | null,
  options: {
    projectId?: string | null;
    activePercentage?: number | null;
    activityCoveredSeconds?: number | null;
  } = {},
) => {
  const start = new Date(startedAt);
  const projectId = options.projectId ?? null;
  return {
    id: `${startedAt}-${projectId}`,
    membershipId: 'm-1',
    projectId,
    projectName: projectId === null ? null : `Project ${projectId}`,
    startedAt: start,
    endedAt:
      durationSeconds === null
        ? null
        : new Date(start.getTime() + durationSeconds * 1000),
    pauses: [],
    durationSeconds,
    activePercentage: options.activePercentage ?? null,
    activityCoveredSeconds: options.activityCoveredSeconds ?? null,
  };
};

describe('memberPeriodStats', () => {
  it('totals each day and zero-fills the rest of the range', () => {
    const stats = memberPeriodStats(
      [
        entry('2026-11-16T09:00:00Z', 3600, { projectId: 'a' }),
        entry('2026-11-18T09:00:00Z', 1800, { projectId: 'b' }),
      ],
      { fromKey: '2026-11-16', toKey: '2026-11-22' },
      'UTC',
    );
    expect(stats.totalSeconds).toBe(5400);
    expect(stats.byDay).toHaveLength(7);
    expect(stats.byDay[0]).toEqual({ dateKey: '2026-11-16', seconds: 3600 });
    expect(stats.byDay[1]).toEqual({ dateKey: '2026-11-17', seconds: 0 });
    expect(stats.byProject.map((p) => p.name)).toEqual([
      'Project a',
      'Project b',
    ]);
  });

  it('counts time tracked on two devices at once only once', () => {
    const stats = memberPeriodStats(
      [
        entry('2026-11-16T09:00:00Z', 3600),
        entry('2026-11-16T09:30:00Z', 3600),
      ],
      { fromKey: '2026-11-16', toKey: '2026-11-16' },
      'UTC',
    );
    expect(stats.totalSeconds).toBe(5400);
  });

  it('leaves out running entries and days outside the range', () => {
    const stats = memberPeriodStats(
      [
        entry('2026-11-16T09:00:00Z', null),
        entry('2026-11-15T09:00:00Z', 3600),
      ],
      { fromKey: '2026-11-16', toKey: '2026-11-16' },
      'UTC',
    );
    expect(stats.totalSeconds).toBe(0);
    expect(stats.byProject).toEqual([]);
  });

  it('puts an entry on the day it started in the organisation timezone', () => {
    // 22:00 UTC on the 15th is 01:00 on the 16th in UTC+3.
    const stats = memberPeriodStats(
      [entry('2026-11-15T22:00:00Z', 600)],
      { fromKey: '2026-11-16', toKey: '2026-11-16' },
      'Indian/Antananarivo',
    );
    expect(stats.totalSeconds).toBe(600);
  });

  it('weights activity by how long each entry was measured', () => {
    const stats = memberPeriodStats(
      [
        entry('2026-11-16T09:00:00Z', 3600, {
          activePercentage: 80,
          activityCoveredSeconds: 3000,
        }),
        entry('2026-11-16T11:00:00Z', 3600, {
          activePercentage: 20,
          activityCoveredSeconds: 1000,
        }),
        entry('2026-11-16T13:00:00Z', 3600),
      ],
      { fromKey: '2026-11-16', toKey: '2026-11-16' },
      'UTC',
    );
    expect(stats.activityPercentage).toBe(65);
  });

  it('reports no activity when nothing was measured', () => {
    const stats = memberPeriodStats(
      [entry('2026-11-16T09:00:00Z', 3600)],
      { fromKey: '2026-11-16', toKey: '2026-11-16' },
      'UTC',
    );
    expect(stats.activityPercentage).toBeNull();
  });
});
