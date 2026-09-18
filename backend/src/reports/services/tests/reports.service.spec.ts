import { Repository } from 'typeorm';
import { Rollup } from '../../../database/entities/rollup.entity';
import { RollupPeriodType } from '../../../database/entities/rollup-period-type.enum';
import { TimeEntry } from '../../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../../database/entities/time-entry-pause.entity';
import { TimeEntrySource } from '../../../database/entities/time-entry-source.enum';
import { ReportsService } from '../reports.service';

describe('ReportsService', () => {
  // A fixed Wednesday — "today" for every test that mixes a completed-day
  // rollup with a live, still-open entry.
  const NOW = new Date(2026, 0, 7, 15, 0, 0);

  function member(id: string, name: string) {
    return { id, user: { name, email: `${name}@acme.test` } };
  }

  function project(id: string, name: string) {
    return { id, name, colour: 'blue' };
  }

  // `membershipId`/`projectId` are the scalar FK columns `ReportsService`
  // actually groups by — the `membership`/`project` relation objects are
  // only consulted for display labels. Every override below must keep
  // both in sync, or the grouping key silently goes missing.
  function rollupRow(
    overrides: Partial<Rollup> & {
      membership?: { id: string; user: { name: string; email: string } };
      project?: { id: string; name: string; colour: string };
    },
  ): Rollup {
    const membership = overrides.membership ?? member('m-1', 'Alice');
    const proj = overrides.project ?? project('p-1', 'Project A');
    return {
      id: `rollup-${Math.random()}`,
      organisationId: 'org-1',
      periodType: RollupPeriodType.DAY,
      membershipId: membership.id,
      projectId: proj.id,
      ...overrides,
      membership,
      project: proj,
    } as unknown as Rollup;
  }

  function liveEntry(
    overrides: Partial<TimeEntry> & {
      membership?: { id: string; user: { name: string; email: string } };
      project?: { id: string; name: string; colour: string };
    },
  ): TimeEntry {
    const membership = overrides.membership ?? member('m-1', 'Alice');
    const proj = overrides.project ?? project('p-1', 'Project A');
    return {
      id: `entry-${Math.random()}`,
      organisationId: 'org-1',
      taskId: null,
      source: TimeEntrySource.WEB,
      deviceId: null,
      membershipId: membership.id,
      projectId: proj.id,
      ...overrides,
      membership,
      project: proj,
    } as unknown as TimeEntry;
  }

  function makeRollupsRepo(rows: Rollup[]) {
    const find = jest.fn().mockResolvedValue(rows);
    return { repo: { find } as unknown as Repository<Rollup>, find };
  }

  function makeTimeEntriesRepo(rows: TimeEntry[]) {
    const find = jest.fn().mockResolvedValue(rows);
    return { repo: { find } as unknown as Repository<TimeEntry>, find };
  }

  function makePausesRepo(): Repository<TimeEntryPause> {
    return {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<TimeEntryPause>;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('groups completed-day rollups by person, resolving the display name from the membership', async () => {
    const rows = [
      rollupRow({
        membership: member('m-1', 'Alice'),
        project: project('p-1', 'Project A'),
        workedSeconds: 3600,
      }),
      rollupRow({
        membership: member('m-2', 'Bob'),
        project: project('p-1', 'Project A'),
        workedSeconds: 1800,
      }),
    ];
    const service = new ReportsService(
      makeRollupsRepo(rows).repo,
      makeTimeEntriesRepo([]).repo,
      makePausesRepo(),
    );

    const report = await service.getReport('org-1', {
      groupBy: 'person',
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 6),
    });

    expect(report).toEqual([
      { key: 'm-1', label: 'Alice', seconds: 3600 },
      { key: 'm-2', label: 'Bob', seconds: 1800 },
    ]);
  });

  it('groups completed-day rollups by project', async () => {
    const rows = [
      rollupRow({ project: project('p-1', 'Project A'), workedSeconds: 3600 }),
      rollupRow({ project: project('p-2', 'Project B'), workedSeconds: 900 }),
    ];
    const service = new ReportsService(
      makeRollupsRepo(rows).repo,
      makeTimeEntriesRepo([]).repo,
      makePausesRepo(),
    );

    const report = await service.getReport('org-1', {
      groupBy: 'project',
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 6),
    });

    expect(report).toEqual([
      { key: 'p-1', label: 'Project A', seconds: 3600 },
      { key: 'p-2', label: 'Project B', seconds: 900 },
    ]);
  });

  it("combines a completed day's rollup with today's live entry for the same person", async () => {
    const rows = [
      rollupRow({
        membership: member('m-1', 'Alice'),
        periodStart: new Date(2026, 0, 5),
        workedSeconds: 3600,
      }),
    ];
    const todayEntries = [
      liveEntry({
        membership: member('m-1', 'Alice'),
        startedAt: new Date(2026, 0, 7, 14, 0, 0),
        endedAt: null, // still running, capped at NOW (15:00) => 1h
      }),
    ];
    const service = new ReportsService(
      makeRollupsRepo(rows).repo,
      makeTimeEntriesRepo(todayEntries).repo,
      makePausesRepo(),
    );

    const report = await service.getReport('org-1', {
      groupBy: 'person',
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 7, 23, 59, 59),
    });

    expect(report).toEqual([
      { key: 'm-1', label: 'Alice', seconds: 3600 + 3600 },
    ]);
  });

  it("skips the live query entirely when the range doesn't reach today", async () => {
    const timeEntries = makeTimeEntriesRepo([]);
    const service = new ReportsService(
      makeRollupsRepo([]).repo,
      timeEntries.repo,
      makePausesRepo(),
    );

    await service.getReport('org-1', {
      groupBy: 'person',
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 5), // ends before today (the 7th)
    });

    expect(timeEntries.find).not.toHaveBeenCalled();
  });

  it('skips the rollup query entirely when the range starts today', async () => {
    const rollups = makeRollupsRepo([]);
    const service = new ReportsService(
      rollups.repo,
      makeTimeEntriesRepo([]).repo,
      makePausesRepo(),
    );

    await service.getReport('org-1', {
      groupBy: 'person',
      from: new Date(2026, 0, 7), // starts today
      to: new Date(2026, 0, 7, 23, 59, 59),
    });

    expect(rollups.find).not.toHaveBeenCalled();
  });

  it('sorts rows descending by seconds', async () => {
    const rows = [
      rollupRow({ membership: member('m-1', 'Alice'), workedSeconds: 100 }),
      rollupRow({ membership: member('m-2', 'Bob'), workedSeconds: 500 }),
    ];
    const service = new ReportsService(
      makeRollupsRepo(rows).repo,
      makeTimeEntriesRepo([]).repo,
      makePausesRepo(),
    );

    const report = await service.getReport('org-1', {
      groupBy: 'person',
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 6),
    });

    expect(report.map((row) => row.key)).toEqual(['m-2', 'm-1']);
  });
});
