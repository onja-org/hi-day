import { EntityManager } from 'typeorm';
import { RollupPeriodType } from '../../../database/entities/rollup-period-type.enum';
import { Rollup } from '../../../database/entities/rollup.entity';
import { TimeEntry } from '../../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../../database/entities/time-entry-pause.entity';
import { RollupService } from '../rollup.service';

describe('RollupService', () => {
  // A fixed Wednesday, mid-morning, so "today" and "the entry's day" are
  // unambiguous in every test.
  const NOW = new Date(2026, 0, 7, 10, 0, 0);

  function entry(overrides: Partial<TimeEntry>): TimeEntry {
    return {
      id: `entry-${Math.random()}`,
      organisationId: 'org-1',
      membershipId: 'm-1',
      projectId: 'p-1',
      taskId: null,
      ...overrides,
    } as TimeEntry;
  }

  function pause(overrides: Partial<TimeEntryPause>): TimeEntryPause {
    return {
      id: `pause-${Math.random()}`,
      organisationId: 'org-1',
      resumedAt: null,
      ...overrides,
    } as TimeEntryPause;
  }

  function makeManager(entries: TimeEntry[], pauses: TimeEntryPause[] = []) {
    const find = jest.fn((target: unknown) => {
      if (target === TimeEntry) return Promise.resolve(entries);
      if (target === TimeEntryPause) return Promise.resolve(pauses);
      throw new Error(`Unexpected find target: ${String(target)}`);
    });
    const upsert = jest.fn().mockResolvedValue(undefined);
    const manager = { find, upsert } as unknown as EntityManager;
    return { manager, find, upsert };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('upserts zero worked seconds when no entries exist for the day', async () => {
    const { manager, upsert } = makeManager([]);
    const service = new RollupService();

    await service.recomputeDay(manager, {
      organisationId: 'org-1',
      membershipId: 'm-1',
      projectId: 'p-1',
      day: new Date(2026, 0, 7),
    });

    expect(upsert).toHaveBeenCalledWith(
      Rollup,
      expect.objectContaining({
        organisationId: 'org-1',
        membershipId: 'm-1',
        projectId: 'p-1',
        periodType: RollupPeriodType.DAY,
        periodStart: new Date(2026, 0, 7, 0, 0, 0),
        workedSeconds: 0,
      }),
      {
        conflictPaths: [
          'membershipId',
          'projectId',
          'periodType',
          'periodStart',
        ],
      },
    );
  });

  it('sums worked seconds across every completed entry that day', async () => {
    const entries = [
      entry({
        startedAt: new Date(2026, 0, 7, 9, 0, 0),
        endedAt: new Date(2026, 0, 7, 10, 0, 0), // 1h
      }),
      entry({
        startedAt: new Date(2026, 0, 7, 13, 0, 0),
        endedAt: new Date(2026, 0, 7, 13, 30, 0), // 0.5h
      }),
    ];
    const { manager, upsert } = makeManager(entries);
    const service = new RollupService();

    await service.recomputeDay(manager, {
      organisationId: 'org-1',
      membershipId: 'm-1',
      projectId: 'p-1',
      day: new Date(2026, 0, 7),
    });

    expect(upsert).toHaveBeenCalledWith(
      Rollup,
      expect.objectContaining({ workedSeconds: 1.5 * 3600 }),
      expect.anything(),
    );
  });

  it('nets out closed pause spans from the gross elapsed time', async () => {
    const target = entry({
      startedAt: new Date(2026, 0, 7, 9, 0, 0),
      endedAt: new Date(2026, 0, 7, 10, 0, 0), // 1h gross
    });
    const pauses = [
      pause({
        timeEntryId: target.id,
        pausedAt: new Date(2026, 0, 7, 9, 30, 0),
        resumedAt: new Date(2026, 0, 7, 9, 40, 0), // 10 min paused
      }),
    ];
    const { manager, upsert } = makeManager([target], pauses);
    const service = new RollupService();

    await service.recomputeDay(manager, {
      organisationId: 'org-1',
      membershipId: 'm-1',
      projectId: 'p-1',
      day: new Date(2026, 0, 7),
    });

    expect(upsert).toHaveBeenCalledWith(
      Rollup,
      expect.objectContaining({ workedSeconds: 50 * 60 }),
      expect.anything(),
    );
  });

  it("caps a still-running entry's contribution at the current instant", async () => {
    const stillRunning = entry({
      startedAt: new Date(2026, 0, 7, 9, 0, 0),
      endedAt: null,
    });
    const { manager, upsert } = makeManager([stillRunning]);
    const service = new RollupService();

    // NOW is 2026-01-07T10:00:00 — 1h after this entry started.
    await service.recomputeDay(manager, {
      organisationId: 'org-1',
      membershipId: 'm-1',
      projectId: 'p-1',
      day: new Date(2026, 0, 7),
    });

    expect(upsert).toHaveBeenCalledWith(
      Rollup,
      expect.objectContaining({ workedSeconds: 3600 }),
      expect.anything(),
    );
  });

  it('scopes the entry lookup to the given membership, project, and calendar day', async () => {
    const { manager, find } = makeManager([]);
    const service = new RollupService();

    await service.recomputeDay(manager, {
      organisationId: 'org-1',
      membershipId: 'm-1',
      projectId: 'p-1',
      day: new Date(2026, 0, 7, 23, 59, 59),
    });

    expect(find).toHaveBeenCalledWith(
      TimeEntry,
      expect.objectContaining({
        where: expect.objectContaining({
          membershipId: 'm-1',
          projectId: 'p-1',
        }) as unknown,
      }),
    );
  });
});
