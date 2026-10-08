import { Repository } from 'typeorm';
import { AppEvent } from '../../../database/entities/app-event.entity';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { ProjectColour } from '../../../database/entities/project-colour.enum';
import { Team } from '../../../database/entities/team.entity';
import { TimeEntry } from '../../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../../database/entities/time-entry-pause.entity';
import { TimeEntrySource } from '../../../database/entities/time-entry-source.enum';
import { UrlSession } from '../../../database/entities/url-session.entity';
import type { ActiveMemberSummary } from '../../../members/services/memberships.service';
import { MembershipsService } from '../../../members/services/memberships.service';
import { ScreenshotsService } from '../../../screenshots/services/screenshots.service';
import { TeamDashboardService } from '../team-dashboard.service';

describe('TeamDashboardService', () => {
  // A fixed Wednesday, so "this week" (Sun 2026-01-04 - Sat 2026-01-10) and
  // "last week" (Sun 2025-12-28 - Sat 2026-01-03) are unambiguous.
  const NOW = new Date(2026, 0, 7, 15, 0, 0);

  function member(
    overrides: Partial<ActiveMemberSummary> & { id: string },
  ): ActiveMemberSummary {
    return {
      userId: `user-${overrides.id}`,
      email: `${overrides.id}@example.test`,
      name: overrides.id,
      role: MembershipRole.MEMBER,
      teamIds: [],
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(2025, 0, 1),
      disclosureRegion: null,
      ...overrides,
    };
  }

  function project(id: string, name = id) {
    return { id, name, colour: ProjectColour.BLUE };
  }

  function entry(
    overrides: Partial<TimeEntry> & { membershipId: string; projectId: string },
  ): TimeEntry {
    return {
      id: `entry-${Math.random()}`,
      organisationId: 'org-1',
      taskId: null,
      source: TimeEntrySource.WEB,
      deviceId: null,
      project: project(overrides.projectId),
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

  // Both repos are only ever queried via a grouped createQueryBuilder(...)
  // .getRawMany() in TeamDashboardService — never .find() — so the mock
  // chain mirrors ProjectsService's own getTaskCounts test pattern
  // (__queryBuilder exposed so a test can assert on the clauses built).
  function makeGroupedQueryBuilderRepo<T extends object>(
    rawRows: Record<string, string>[],
  ) {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rawRows),
    };
    return {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      __queryBuilder: queryBuilder,
    } as unknown as Repository<T> & { __queryBuilder: typeof queryBuilder };
  }

  function makeAppEventsRepo(
    rawRows: { appName: string; count: string }[] = [],
  ) {
    return makeGroupedQueryBuilderRepo<AppEvent>(rawRows);
  }

  function makeUrlSessionsRepo(
    rawRows: { host: string; totalActiveMs: string }[] = [],
  ) {
    return makeGroupedQueryBuilderRepo<UrlSession>(rawRows);
  }

  function makeMembershipsService(
    members: ActiveMemberSummary[],
  ): MembershipsService {
    return {
      listActiveForOrganisation: jest.fn().mockResolvedValue(members),
    } as unknown as MembershipsService;
  }

  function makeScreenshotsService(
    byMembershipId: Record<string, unknown[]> = {},
  ): ScreenshotsService {
    return {
      getScreenshotsForMembership: jest
        .fn()
        .mockImplementation(
          (_orgId: string, _callerId: string, membershipId: string) =>
            Promise.resolve(byMembershipId[membershipId] ?? []),
        ),
    } as unknown as ScreenshotsService;
  }

  function makeTeamsRepo(
    teams: { id: string; name: string; memberIds: string[] }[] = [],
  ): Repository<Team> {
    return {
      find: jest.fn().mockResolvedValue(
        teams.map((team) => ({
          id: team.id,
          name: team.name,
          teamMemberships: team.memberIds.map((membershipId) => ({
            membershipId,
            teamId: team.id,
          })),
        })),
      ),
    } as unknown as Repository<Team>;
  }

  function makeCallerRepo(
    caller: {
      role: MembershipRole;
      managedTeamIds?: string[];
    } | null = { role: MembershipRole.ADMIN },
  ): Repository<Membership> {
    return {
      findOne: jest.fn().mockResolvedValue(
        caller && {
          role: caller.role,
          teamMemberships: (caller.managedTeamIds ?? []).map((teamId) => ({
            teamId,
            isManager: true,
          })),
        },
      ),
    } as unknown as Repository<Membership>;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a zeroed, empty summary without querying entries when the caller is scoped to no members', async () => {
    const find = jest.fn();
    const service = new TeamDashboardService(
      { find } as unknown as Repository<TimeEntry>,
      makePausesRepo(),
      makeAppEventsRepo(),
      makeUrlSessionsRepo(),
      makeMembershipsService([]),
      makeScreenshotsService(),
      makeTeamsRepo(),
      makeCallerRepo(),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    expect(summary.memberCount).toBe(0);
    expect(summary.workedThisWeekSeconds).toBe(0);
    expect(summary.members).toEqual([]);
    expect(summary.recentActivity).toEqual([]);
    expect(summary.appsAndSites).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });

  it('aggregates seconds and projects worked across every scoped member', async () => {
    const members = [member({ id: 'm-1' }), member({ id: 'm-2' })];
    const thisWeekEntries = [
      entry({
        membershipId: 'm-1',
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 7, 9, 0, 0),
        endedAt: new Date(2026, 0, 7, 11, 0, 0), // 2h
      }),
      entry({
        membershipId: 'm-2',
        projectId: 'p-2',
        startedAt: new Date(2026, 0, 7, 9, 0, 0),
        endedAt: new Date(2026, 0, 7, 10, 0, 0), // 1h
      }),
    ];
    const service = new TeamDashboardService(
      makeTimeEntriesRepo(thisWeekEntries, [], []),
      makePausesRepo(),
      makeAppEventsRepo(),
      makeUrlSessionsRepo(),
      makeMembershipsService(members),
      makeScreenshotsService(),
      makeTeamsRepo(),
      makeCallerRepo(),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    expect(summary.memberCount).toBe(2);
    expect(summary.workedThisWeekSeconds).toBe(3 * 3600);
    expect(summary.projectsWorkedThisWeek).toBe(2);
    expect(summary.members).toEqual([
      expect.objectContaining({
        membershipId: 'm-1',
        workedThisWeekSeconds: 2 * 3600,
      }),
      expect.objectContaining({
        membershipId: 'm-2',
        workedThisWeekSeconds: 1 * 3600,
      }),
    ]);
  });

  it('marks a member with an open entry as working and surfaces their current project', async () => {
    const members = [member({ id: 'm-1' })];
    const runningEntry = entry({
      membershipId: 'm-1',
      projectId: 'p-1',
      startedAt: new Date(2026, 0, 7, 14, 0, 0),
      endedAt: null,
    });
    const service = new TeamDashboardService(
      makeTimeEntriesRepo([runningEntry], [], [runningEntry]),
      makePausesRepo(),
      makeAppEventsRepo(),
      makeUrlSessionsRepo(),
      makeMembershipsService(members),
      makeScreenshotsService(),
      makeTeamsRepo(),
      makeCallerRepo(),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    expect(summary.members[0].isWorking).toBe(true);
    expect(summary.members[0].currentProjectName).toBe('p-1');
    expect(summary.members[0].workedTodaySeconds).toBe(3600);
  });

  it('caps recent activity to members who worked today, busiest first', async () => {
    const members = [member({ id: 'm-idle' }), member({ id: 'm-busy' })];
    const thisWeekEntries = [
      entry({
        membershipId: 'm-busy',
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 7, 9, 0, 0),
        endedAt: new Date(2026, 0, 7, 11, 0, 0),
      }),
    ];
    const service = new TeamDashboardService(
      makeTimeEntriesRepo(thisWeekEntries, [], []),
      makePausesRepo(),
      makeAppEventsRepo(),
      makeUrlSessionsRepo(),
      makeMembershipsService(members),
      makeScreenshotsService({ 'm-busy': [{ id: 's-1' }, { id: 's-2' }] }),
      makeTeamsRepo(),
      makeCallerRepo(),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    expect(summary.recentActivity).toHaveLength(1);
    expect(summary.recentActivity[0].membershipId).toBe('m-busy');
    expect(summary.recentActivity[0].screenshots).toHaveLength(2);
  });

  it('combines already-grouped app and browser-domain totals into one ranked list', async () => {
    const members = [member({ id: 'm-1' }), member({ id: 'm-2' })];
    const service = new TeamDashboardService(
      makeTimeEntriesRepo([], [], []),
      makePausesRepo(),
      // 3 five-second Slack samples -> 15s; 2 Chrome samples -> 10s.
      makeAppEventsRepo([
        { appName: 'Slack', count: '3' },
        { appName: 'Chrome', count: '2' },
      ]),
      makeUrlSessionsRepo([
        { host: 'docs.google.com', totalActiveMs: '20000' },
      ]),
      makeMembershipsService(members),
      makeScreenshotsService(),
      makeTeamsRepo(),
      makeCallerRepo(),
    );

    const summary = await service.getSummary('org-1', 'user-1');

    expect(summary.appsAndSites).toEqual([
      { label: 'docs.google.com', seconds: 20 },
      { label: 'Slack', seconds: 15 },
      { label: 'Chrome', seconds: 10 },
    ]);
  });

  it('excludes private URL sessions in the query itself (empty host), not in application code', async () => {
    const members = [member({ id: 'm-1' })];
    const urlSessionsRepo = makeUrlSessionsRepo([]);
    const service = new TeamDashboardService(
      makeTimeEntriesRepo([], [], []),
      makePausesRepo(),
      makeAppEventsRepo([]),
      urlSessionsRepo,
      makeMembershipsService(members),
      makeScreenshotsService(),
      makeTeamsRepo(),
      makeCallerRepo(),
    );

    await service.getSummary('org-1', 'user-1');

    const queryBuilder = (
      urlSessionsRepo as unknown as {
        __queryBuilder: Record<string, jest.Mock>;
      }
    ).__queryBuilder;
    expect(queryBuilder.andWhere).toHaveBeenCalledWith("urlSession.host != ''");
  });

  it('aggregates app/site usage in the database rather than loading every raw row', async () => {
    const members = [member({ id: 'm-1' })];
    const appEventsRepo = makeAppEventsRepo([]);
    const service = new TeamDashboardService(
      makeTimeEntriesRepo([], [], []),
      makePausesRepo(),
      appEventsRepo,
      makeUrlSessionsRepo([]),
      makeMembershipsService(members),
      makeScreenshotsService(),
      makeTeamsRepo(),
      makeCallerRepo(),
    );

    await service.getSummary('org-1', 'user-1');

    const repo = appEventsRepo as unknown as {
      createQueryBuilder: jest.Mock;
      __queryBuilder: Record<string, jest.Mock>;
    };
    expect(repo.createQueryBuilder).toHaveBeenCalled();
    expect(repo.__queryBuilder.groupBy).toHaveBeenCalledWith(
      'appEvent.appName',
    );
  });

  describe('teamsThisWeek', () => {
    const members = [member({ id: 'm-1' }), member({ id: 'm-2' })];
    const teams = [
      { id: 't-design', name: 'Design', memberIds: ['m-1'] },
      { id: 't-eng', name: 'Engineering', memberIds: ['m-1', 'm-2'] },
      { id: 't-empty', name: 'Support', memberIds: [] },
    ];
    const thisWeekEntries = () => [
      entry({
        membershipId: 'm-1',
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 7, 9, 0, 0),
        endedAt: new Date(2026, 0, 7, 11, 0, 0), // 2h
      }),
      entry({
        membershipId: 'm-2',
        projectId: 'p-1',
        startedAt: new Date(2026, 0, 7, 9, 0, 0),
        endedAt: new Date(2026, 0, 7, 10, 0, 0), // 1h
      }),
    ];

    function serviceFor(caller: Parameters<typeof makeCallerRepo>[0]) {
      return new TeamDashboardService(
        makeTimeEntriesRepo(thisWeekEntries(), [], []),
        makePausesRepo(),
        makeAppEventsRepo(),
        makeUrlSessionsRepo(),
        makeMembershipsService(members),
        makeScreenshotsService(),
        makeTeamsRepo(teams),
        makeCallerRepo(caller),
      );
    }

    it('gives an admin every team, busiest first, counting someone in two teams towards both', async () => {
      const summary = await serviceFor({ role: MembershipRole.ADMIN }).getSummary(
        'org-1',
        'user-1',
      );

      expect(summary.teamsThisWeek).toEqual([
        { teamId: 't-eng', teamName: 'Engineering', seconds: 3 * 3600 },
        { teamId: 't-design', teamName: 'Design', seconds: 2 * 3600 },
        { teamId: 't-empty', teamName: 'Support', seconds: 0 },
      ]);
    });

    it('gives a manager only the teams they manage', async () => {
      const summary = await serviceFor({
        role: MembershipRole.MANAGER,
        managedTeamIds: ['t-design'],
      }).getSummary('org-1', 'user-1');

      expect(summary.teamsThisWeek).toEqual([
        { teamId: 't-design', teamName: 'Design', seconds: 2 * 3600 },
      ]);
    });

    it('is empty when the caller has no active membership', async () => {
      const summary = await serviceFor(null).getSummary('org-1', 'user-1');

      expect(summary.teamsThisWeek).toEqual([]);
    });
  });
});
