import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { ProjectColour } from '../../../database/entities/project-colour.enum';
import { TimeEntry } from '../../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../../database/entities/time-entry-pause.entity';
import { TimeEntrySource } from '../../../database/entities/time-entry-source.enum';
import { OrganisationsService } from '../../../organisations/services/organisations.service';
import { DashboardService } from '../dashboard.service';

describe('DashboardService', () => {
  // A fixed Wednesday, so "this week" (Sun 2026-01-04 - Sat 2026-01-10) and
  // "last week" (Sun 2025-12-28 - Sat 2026-01-03) are unambiguous.
  const NOW = new Date(2026, 0, 7, 15, 0, 0);

  const membership = {
    id: 'm-1',
    userId: 'user-1',
    organisationId: 'org-1',
    status: MembershipStatus.ACTIVE,
  } as Membership;

  function project(id: string, name: string) {
    return { id, name, colour: ProjectColour.BLUE };
  }

  function entry(
    overrides: Partial<TimeEntry> & { projectId: string },
  ): TimeEntry {
    return {
      id: `entry-${Math.random()}`,
      organisationId: 'org-1',
      membershipId: 'm-1',
      taskId: null,
      source: TimeEntrySource.WEB,
      deviceId: null,
      project: project(overrides.projectId, overrides.projectId),
      ...overrides,
    } as TimeEntry;
  }

  function makeTimeEntriesRepo(...calls: TimeEntry[][]): Repository<TimeEntry> {
    const find = jest.fn();
    calls.forEach((result) => find.mockResolvedValueOnce(result));
    return { find } as unknown as Repository<TimeEntry>;
  }

  function makePausesRepo(): Repository<TimeEntryPause> {
    return {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<TimeEntryPause>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ): Repository<Membership> {
    return {
      findOne: jest.fn().mockResolvedValue(membership),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeOrganisationsService(hoursPerDay = 8): OrganisationsService {
    return {
      getWorkingHoursPolicy: jest.fn().mockResolvedValue({ hoursPerDay }),
    } as unknown as OrganisationsService;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sums today and week-to-date, and zero-fills days with no entries', async () => {
    const thisWeekEntries = [
      entry({
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 7, 9, 0, 0), // Wed = today
        endedAt: new Date(2026, 0, 7, 11, 0, 0), // 2h
      }),
      entry({
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 5, 9, 0, 0), // Mon
        endedAt: new Date(2026, 0, 5, 10, 30, 0), // 1.5h
      }),
    ];
    const service = new DashboardService(
      makeTimeEntriesRepo(thisWeekEntries, [], []),
      makePausesRepo(),
      makeMembershipsRepo(),
      makeOrganisationsService(),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    expect(summary.workedTodaySeconds).toBe(2 * 3600);
    expect(summary.workedThisWeekSeconds).toBe(2 * 3600 + 1.5 * 3600);

    expect(summary.thisWeekByDay).toHaveLength(7);
    expect(summary.thisWeekByDay.map((day) => day.seconds)).toEqual([
      0, // Sun
      1.5 * 3600, // Mon
      0, // Tue
      2 * 3600, // Wed (today)
      0, // Thu
      0, // Fri
      0, // Sat
    ]);
    expect(summary.thisWeekByDay[3].date).toBe('2026-01-07');
  });

  it('computes week-over-week and day-over-day deltas from the same-span comparison periods', async () => {
    const thisWeekEntries = [
      entry({
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 7, 9, 0, 0),
        endedAt: new Date(2026, 0, 7, 11, 0, 0), // 2h today, 2h this week
      }),
    ];
    const yesterdaySameSpanEntries = [
      entry({
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 6, 9, 0, 0),
        endedAt: new Date(2026, 0, 6, 10, 0, 0), // 1h
      }),
    ];
    const lastWeekSameSpanEntries = [
      entry({
        projectId: 'p-1',
        startedAt: new Date(2025, 11, 31, 9, 0, 0),
        endedAt: new Date(2025, 11, 31, 9, 30, 0), // 0.5h
      }),
    ];
    const service = new DashboardService(
      makeTimeEntriesRepo(
        thisWeekEntries,
        yesterdaySameSpanEntries,
        lastWeekSameSpanEntries,
      ),
      makePausesRepo(),
      makeMembershipsRepo(),
      makeOrganisationsService(),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    expect(summary.workedTodayDeltaSeconds).toBe(2 * 3600 - 1 * 3600);
    expect(summary.workedThisWeekDeltaSeconds).toBe(2 * 3600 - 0.5 * 3600);
  });

  it("counts today's still-running entry in projectsToday, matching workedTodaySeconds", async () => {
    const thisWeekEntries = [
      entry({
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 7, 9, 0, 0),
        endedAt: new Date(2026, 0, 7, 10, 30, 0), // 1.5h, completed
      }),
      entry({
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 7, 14, 0, 0),
        endedAt: null, // still running at NOW (15:00) => 1h so far
      }),
    ];
    const service = new DashboardService(
      makeTimeEntriesRepo(thisWeekEntries, [], []),
      makePausesRepo(),
      makeMembershipsRepo(),
      makeOrganisationsService(),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    // The breakdown and the day's total describe the same time.
    expect(summary.workedTodaySeconds).toBe(1.5 * 3600 + 1 * 3600);
    expect(summary.projectsToday).toEqual([
      expect.objectContaining({ projectId: 'p-1', seconds: 2.5 * 3600 }),
    ]);
  });

  it('reports a projects-worked delta against the same-span last week', async () => {
    const thisWeekEntries = [
      entry({
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 7, 9, 0, 0),
        endedAt: new Date(2026, 0, 7, 10, 0, 0),
      }),
      entry({
        projectId: 'p-2',
        startedAt: new Date(2026, 0, 7, 10, 0, 0),
        endedAt: new Date(2026, 0, 7, 11, 0, 0),
      }),
    ];
    const lastWeekSameSpanEntries = [
      entry({
        projectId: 'p-1',
        startedAt: new Date(2025, 11, 31, 9, 0, 0),
        endedAt: new Date(2025, 11, 31, 10, 0, 0),
      }),
    ];
    const service = new DashboardService(
      makeTimeEntriesRepo(thisWeekEntries, [], lastWeekSameSpanEntries),
      makePausesRepo(),
      makeMembershipsRepo(),
      makeOrganisationsService(),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    expect(summary.projectsWorkedThisWeek).toBe(2);
    expect(summary.projectsWorkedDelta).toBe(1);
    expect(summary.projectsThisWeek.map((p) => p.projectId)).toEqual([
      'p-1',
      'p-2',
    ]);
  });

  it('rejects when the caller has no active membership in the organisation', async () => {
    const service = new DashboardService(
      makeTimeEntriesRepo([], [], []),
      makePausesRepo(),
      makeMembershipsRepo({ findOne: jest.fn().mockResolvedValue(null) }),
      makeOrganisationsService(),
    );

    await expect(service.getSummary('org-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("includes the organisation's configured daily-hours target", async () => {
    const service = new DashboardService(
      makeTimeEntriesRepo([], [], []),
      makePausesRepo(),
      makeMembershipsRepo(),
      makeOrganisationsService(6),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    expect(summary.workingHoursPerDayTarget).toBe(6);
  });
});
