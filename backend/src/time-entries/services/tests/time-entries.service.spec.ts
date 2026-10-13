import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Between, EntityManager, Not, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { CaptureCleanupService } from '../../../captures/services/capture-cleanup.service';
import type { PrunedCaptures } from '../../../captures/services/capture-cleanup.service';
import { ActivitySample } from '../../../database/entities/activity-sample.entity';
import { Membership } from '../../../database/entities/membership.entity';
import { Organisation } from '../../../database/entities/organisation.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { Project } from '../../../database/entities/project.entity';
import { ProjectMembership } from '../../../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../../../database/entities/project-membership-role.enum';
import { ProjectTeam } from '../../../database/entities/project-team.entity';
import { Task } from '../../../database/entities/task.entity';
import { TimeEntry } from '../../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../../database/entities/time-entry-pause.entity';
import { TimeEntrySource } from '../../../database/entities/time-entry-source.enum';
import { TimeEntriesService } from '../time-entries.service';

describe('TimeEntriesService', () => {
  function makeTimeEntriesRepo(overrides: Partial<Repository<TimeEntry>> = {}) {
    return {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((input: Partial<TimeEntry>) => input as TimeEntry),
      save: jest.fn((input: Partial<TimeEntry>) =>
        Promise.resolve({ id: 'entry-1', ...input } as TimeEntry),
      ),
      // The abandoned-entry closer joins Device from here; nothing abandoned
      // unless a test says so.
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawAndEntities: jest
          .fn()
          .mockResolvedValue({ entities: [], raw: [] }),
      })),
      ...overrides,
    } as unknown as Repository<TimeEntry>;
  }

  function makeTimeEntryPausesRepo(
    overrides: Partial<Repository<TimeEntryPause>> = {},
  ) {
    return {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(
        (input: Partial<TimeEntryPause>) => input as TimeEntryPause,
      ),
      save: jest.fn((input: Partial<TimeEntryPause>) =>
        Promise.resolve({ id: 'pause-1', ...input } as TimeEntryPause),
      ),
      ...overrides,
    } as unknown as Repository<TimeEntryPause>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeProjectMembershipsRepo(
    overrides: Partial<Repository<ProjectMembership>> = {},
  ) {
    return {
      findOne: jest.fn().mockResolvedValue({ id: 'pm-1' }),
      ...overrides,
    } as unknown as Repository<ProjectMembership>;
  }

  function makeProjectTeamsRepo(getOne = jest.fn().mockResolvedValue(null)) {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne,
    };
    return {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<ProjectTeam>;
  }

  function makeProjectsRepo(overrides: Partial<Repository<Project>> = {}) {
    return {
      findOne: jest.fn().mockResolvedValue(baseProject),
      ...overrides,
    } as unknown as Repository<Project>;
  }

  function makeTasksRepo(overrides: Partial<Repository<Task>> = {}) {
    return {
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides,
    } as unknown as Repository<Task>;
  }

  function makeDataSource() {
    const save = jest.fn().mockResolvedValue(undefined);
    const pausesRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const remove = jest.fn().mockResolvedValue({ affected: 1 });
    const find = jest.fn().mockResolvedValue([]);
    const manager = {
      save: jest.fn((input: Partial<TimeEntry>) =>
        Promise.resolve({ id: 'entry-2', ...input } as TimeEntry),
      ),
      create: jest.fn((_entity: unknown, input: Partial<TimeEntry>) => input),
      findOne: jest.fn().mockResolvedValue(null),
      find: find,
      delete: remove,
      getRepository: jest.fn().mockReturnValue(pausesRepo),
    } as unknown as EntityManager;
    const transaction = jest.fn(
      (fn: (manager: EntityManager) => Promise<unknown>) => fn(manager),
    );
    return {
      dataSource: { transaction } as unknown,
      transaction,
      save,
      remove,
      find,
      manager,
    };
  }

  function makeCaptureCleanup(pruned: Partial<PrunedCaptures> = {}) {
    const pruneUncovered = jest.fn().mockResolvedValue({
      appEvents: 0,
      urlSessions: 0,
      screenshots: 0,
      storageKeys: [],
      ...pruned,
    });
    const deleteStoredObjects = jest.fn().mockResolvedValue(undefined);
    return {
      captureCleanup: {
        pruneUncovered,
        deleteStoredObjects,
      } as unknown as CaptureCleanupService,
      pruneUncovered,
      deleteStoredObjects,
    };
  }

  function makeActivitySamplesRepo(rows: ActivitySample[] = []) {
    return {
      find: jest.fn().mockResolvedValue(rows),
    } as unknown as Repository<ActivitySample>;
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  /**
   * Only the day-boundary splitter reads it, for the Organisation's
   * timezone. Defaults to UTC so the split lands on a fixed instant whatever
   * timezone the test runner sits in — CI is UTC, this machine is not, and a
   * server-local expectation passes in one and fails in the other.
   */
  function makeOrganisationsRepo(timezone = 'UTC') {
    return {
      findOne: jest.fn().mockResolvedValue({ settings: { timezone } }),
    } as unknown as Repository<Organisation>;
  }

  function makeService(
    overrides: {
      timeEntriesRepo?: Repository<TimeEntry>;
      timeEntryPausesRepo?: Repository<TimeEntryPause>;
      membershipsRepo?: Repository<Membership>;
      organisationsRepo?: Repository<Organisation>;
      projectMembershipsRepo?: Repository<ProjectMembership>;
      projectTeamsRepo?: Repository<ProjectTeam>;
      projectsRepo?: Repository<Project>;
      tasksRepo?: Repository<Task>;
      activitySamplesRepo?: Repository<ActivitySample>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
      captureCleanup?: CaptureCleanupService;
    } = {},
  ) {
    return new TimeEntriesService(
      overrides.timeEntriesRepo ?? makeTimeEntriesRepo(),
      overrides.timeEntryPausesRepo ?? makeTimeEntryPausesRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      overrides.organisationsRepo ?? makeOrganisationsRepo(),
      overrides.projectMembershipsRepo ?? makeProjectMembershipsRepo(),
      overrides.projectTeamsRepo ?? makeProjectTeamsRepo(),
      overrides.projectsRepo ?? makeProjectsRepo(),
      overrides.tasksRepo ?? makeTasksRepo(),
      overrides.activitySamplesRepo ?? makeActivitySamplesRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
      overrides.captureCleanup ?? makeCaptureCleanup().captureCleanup,
    );
  }

  const baseProject = {
    id: 'project-1',
    organisationId: 'org-1',
    archivedAt: null,
  } as Project;

  const baseTask = {
    id: 'task-1',
    projectId: 'project-1',
    closedAt: null,
  } as Task;

  const runningEntry = {
    id: 'entry-running',
    membershipId: 'm-1',
    projectId: 'project-1',
    taskId: null,
    startedAt: new Date('2026-01-01T09:00:00Z'),
    endedAt: null,
    source: TimeEntrySource.WEB,
    deviceId: null,
  } as TimeEntry;

  describe('start', () => {
    it('starts a timer and records an audit log entry', async () => {
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ auditLogService });

      const result = await service.start(
        'org-1',
        'user-1',
        'project-1',
        undefined,
        TimeEntrySource.WEB,
        null,
      );

      expect(result.projectId).toBe('project-1');
      expect(result.endedAt).toBeNull();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.started' }),
      );
    });

    it('starts at the time an offline device pressed start, never in the future', async () => {
      const create = jest.fn((value: object) => value);
      const timeEntriesRepo = makeTimeEntriesRepo({
        create,
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ timeEntriesRepo });
      const past = new Date(Date.now() - 3_600_000);

      await service.start(
        'org-1',
        'user-1',
        'project-1',
        undefined,
        TimeEntrySource.AGENT,
        'device-1',
        past,
      );
      expect(create).toHaveBeenLastCalledWith(
        expect.objectContaining({ startedAt: past }),
      );

      await service.start(
        'org-1',
        'user-1',
        'project-1',
        undefined,
        TimeEntrySource.AGENT,
        'device-1',
        new Date(Date.now() + 3_600_000),
      );
      const used = create.mock.calls[1][0] as { startedAt: Date };
      expect(used.startedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    /**
     * The web is account-level, so a timer running anywhere blocks a web
     * start — otherwise it becomes a second parallel timer of its own.
     */
    it('rejects a web start with a 409 when a timer is running on any device', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([runningEntry]),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'project-1',
          undefined,
          TimeEntrySource.WEB,
          null,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    /**
     * A second Device joining the project already running is the case this
     * whole change exists for — it must not be refused.
     */
    it('allows a second device to start the same project', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest
          .fn()
          .mockResolvedValue([{ ...runningEntry, deviceId: 'device-a' }]),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.start(
          'org-1',
          'user-1',
          runningEntry.projectId,
          undefined,
          TimeEntrySource.AGENT,
          'device-b',
        ),
      ).resolves.toBeDefined();
    });

    it('lets a second device start a different project', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest
          .fn()
          .mockResolvedValue([{ ...runningEntry, deviceId: 'device-a' }]),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'a-different-project',
          undefined,
          TimeEntrySource.AGENT,
          'device-b',
        ),
      ).resolves.toBeDefined();
    });

    it('lets the web join the project a device is already tracking', async () => {
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          find: jest
            .fn()
            .mockResolvedValue([
              { ...runningEntry, projectId: 'project-1', deviceId: 'device-a' },
            ]),
        }),
      });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'project-1',
          undefined,
          TimeEntrySource.WEB,
          null,
        ),
      ).resolves.toBeDefined();
    });

    it('refuses the web a different project from the one a device is tracking', async () => {
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          find: jest
            .fn()
            .mockResolvedValue([
              { ...runningEntry, projectId: 'project-1', deviceId: 'device-a' },
            ]),
        }),
      });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'a-different-project',
          undefined,
          TimeEntrySource.WEB,
          null,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses a second web timer, so browsers share one between them', async () => {
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          find: jest
            .fn()
            .mockResolvedValue([{ ...runningEntry, deviceId: null }]),
        }),
      });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'project-1',
          undefined,
          TimeEntrySource.WEB,
          null,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('still refuses a second timer on the device already tracking', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest
          .fn()
          .mockResolvedValue([{ ...runningEntry, deviceId: 'device-a' }]),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'a-different-project',
          undefined,
          TimeEntrySource.AGENT,
          'device-a',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a caller with no active organisation membership', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'project-1',
          undefined,
          TimeEntrySource.WEB,
          null,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows an org admin/manager without a ProjectMembership', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo, projectMembershipsRepo });

      const result = await service.start(
        'org-1',
        'admin-1',
        'project-1',
        undefined,
        TimeEntrySource.WEB,
        null,
      );

      expect(result.projectId).toBe('project-1');
    });

    it('rejects a plain member with no ProjectMembership on this project', async () => {
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ projectMembershipsRepo });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'project-1',
          undefined,
          TimeEntrySource.WEB,
          null,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a project viewer, who can see the project but not track time on it', async () => {
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'pm-1',
          role: ProjectMembershipRole.VIEWER,
        }),
      });
      const service = makeService({ projectMembershipsRepo });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'project-1',
          undefined,
          TimeEntrySource.WEB,
          null,
        ),
      ).rejects.toThrow(
        'Project viewers can see this project but can’t log time on it.',
      );
    });

    it('rejects starting against an archived project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseProject, archivedAt: new Date() }),
      });
      const service = makeService({ projectsRepo });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'project-1',
          undefined,
          TimeEntrySource.WEB,
          null,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects starting against a closed task', async () => {
      const tasksRepo = makeTasksRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseTask, closedAt: new Date() }),
      });
      const service = makeService({ tasksRepo });

      await expect(
        service.start(
          'org-1',
          'user-1',
          'project-1',
          'task-1',
          TimeEntrySource.WEB,
          null,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows starting against an open task', async () => {
      const tasksRepo = makeTasksRepo({
        findOne: jest.fn().mockResolvedValue(baseTask),
      });
      const service = makeService({ tasksRepo });

      const result = await service.start(
        'org-1',
        'user-1',
        'project-1',
        'task-1',
        TimeEntrySource.WEB,
        null,
      );

      expect(result.taskId).toBe('task-1');
    });
  });

  describe('currentForAccount', () => {
    it("reports the web's own timer as its entry, not a device's", async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([
          { ...runningEntry, id: 'on-laptop', deviceId: 'device-a' },
          { ...runningEntry, id: 'on-web', deviceId: null },
        ]),
      });
      const service = makeService({ timeEntriesRepo });

      const current = await service.currentForAccount('org-1', 'user-1');

      expect(current.entry?.id).toBe('on-web');
      expect(current.elsewhere?.id).toBe('on-laptop');
    });

    it('reports neither when nothing is running, leaving the web free to start', async () => {
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          find: jest.fn().mockResolvedValue([]),
        }),
      });

      const current = await service.currentForAccount('org-1', 'user-1');

      expect(current.entry).toBeNull();
      expect(current.elsewhere).toBeNull();
    });

    it("does not report the web's own timer as elsewhere", async () => {
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          find: jest
            .fn()
            .mockResolvedValue([
              { ...runningEntry, id: 'on-web', deviceId: null },
            ]),
        }),
      });

      const current = await service.currentForAccount('org-1', 'user-1');

      expect(current.entry?.id).toBe('on-web');
      expect(current.elsewhere).toBeNull();
    });

    it('reports a device as elsewhere when the web has no timer of its own', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest
          .fn()
          .mockResolvedValue([
            { ...runningEntry, id: 'on-laptop', deviceId: 'device-a' },
          ]),
      });
      const service = makeService({ timeEntriesRepo });

      const current = await service.currentForAccount('org-1', 'user-1');

      expect(current.entry).toBeNull();
      expect(current.elsewhere?.id).toBe('on-laptop');
    });
  });

  describe('stop', () => {
    it('stops the running timer and records an audit log entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ timeEntriesRepo, auditLogService });

      const result = await service.stop('org-1', 'user-1', null);

      expect(result.endedAt).not.toBeNull();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.stopped' }),
      );
    });

    it('throws when no timer is running', async () => {
      const service = makeService();

      await expect(
        service.stop('org-1', 'user-1', null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('backdates the stop when given an explicit endedAt, and notes it was idle-discarded', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ timeEntriesRepo, auditLogService });
      const backdatedEndedAt = new Date(Date.now() - 60_000);

      const result = await service.stop(
        'org-1',
        'user-1',
        null,
        backdatedEndedAt,
      );

      expect(result.endedAt).toEqual(backdatedEndedAt);
      expect(record).toHaveBeenCalledTimes(1);
      const call = record.mock.calls[0] as [
        unknown,
        { metadata: { reason: string } },
      ];
      expect(call[1].metadata.reason).toBe('idle');
    });

    it('rejects a backdated stop at or before the entry started', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.stop('org-1', 'user-1', null, new Date('2025-12-31T00:00:00Z')),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a stop dated in the future', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.stop('org-1', 'user-1', null, new Date(Date.now() + 60_000)),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('createManual', () => {
    // Manual entry is admin-only, so every baseline case here needs an
    // admin caller — a plain member can't reach any of this code.
    function makeAdminMembershipsRepo() {
      return makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
      });
    }

    it('refuses a span that overlaps time already tracked on a device', async () => {
      // The reason manual gets its own scope: a manual entry has no Device,
      // a tracked one does, so a device-scoped check would never see this.
      const service = makeService({
        membershipsRepo: makeAdminMembershipsRepo(),
        timeEntriesRepo: makeTimeEntriesRepo({
          findOne: jest.fn().mockResolvedValue({
            ...runningEntry,
            deviceId: 'device-a',
            endedAt: new Date('2026-01-01T10:30:00.000Z'),
          }),
        }),
      });

      await expect(
        service.createManual('org-1', 'user-1', 'project-1', {
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: '2026-01-01T10:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    /**
     * Creating excludes no entry, because none exists yet. Passing an empty
     * string instead of omitting the clause reached Postgres as a uuid and
     * failed the whole request with a 500 — invisible to a mocked repository,
     * so this asserts the shape of the query rather than its result.
     */
    it('searches without excluding any entry id', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = makeService({
        membershipsRepo: makeAdminMembershipsRepo(),
        timeEntriesRepo: makeTimeEntriesRepo({ findOne }),
      });

      await service.createManual('org-1', 'user-1', 'project-1', {
        startedAt: '2026-01-01T09:00:00.000Z',
        endedAt: '2026-01-01T10:00:00.000Z',
      });

      const [[query]] = findOne.mock.calls as [[{ where: object[] }]];
      const where = query.where;
      for (const clause of where) {
        expect(clause).not.toHaveProperty('id');
      }
    });

    it('allows a span with nothing else in the way', async () => {
      const service = makeService({
        membershipsRepo: makeAdminMembershipsRepo(),
        timeEntriesRepo: makeTimeEntriesRepo({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.createManual('org-1', 'user-1', 'project-1', {
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: '2026-01-01T10:00:00.000Z',
        }),
      ).resolves.toBeDefined();
    });

    it('creates a completed entry with source=manual and records an audit log entry', async () => {
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        auditLogService,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      const result = await service.createManual(
        'org-1',
        'user-1',
        'project-1',
        {
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: '2026-01-01T10:00:00.000Z',
        },
      );

      expect(result.source).toBe(TimeEntrySource.MANUAL);
      expect(result.endedAt).not.toBeNull();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.created_manually' }),
      );
    });

    it('rejects an end time before the start time', async () => {
      const service = makeService({
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await expect(
        service.createManual('org-1', 'user-1', 'project-1', {
          startedAt: '2026-01-01T10:00:00.000Z',
          endedAt: '2026-01-01T09:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an end time in the future', async () => {
      const service = makeService({
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await expect(
        service.createManual('org-1', 'user-1', 'project-1', {
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // Note there's deliberately no "allowed caller without project access"
    // case: the only role that may create manually is admin, and an admin
    // always clears assertProjectAccess, so that combination describes
    // nobody.
    it('rejects a plain member logging their own time manually', async () => {
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'pm-1', role: 'member' }),
      });
      const service = makeService({ projectMembershipsRepo });

      await expect(
        service.createManual('org-1', 'user-1', 'project-1', {
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: '2026-01-01T10:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a manager logging their own time manually', async () => {
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({
            id: 'm-manager',
            role: MembershipRole.MANAGER,
          }),
        }),
      });

      await expect(
        service.createManual('org-1', 'manager-1', 'project-1', {
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: '2026-01-01T10:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    describe('logging for someone else (dto.membershipId)', () => {
      // Distinguishes the caller lookup (by userId) from the target lookup
      // (by membership id) — the shared default mock returns one fixed
      // membership regardless of query, which isn't enough here.
      function makeMembershipsRepoFor(
        caller: { id: string; role: MembershipRole },
        target: { id: string } | null,
      ) {
        return {
          findOne: jest.fn(
            (options: { where: { userId?: string; id?: string } }) => {
              if (options.where.userId) {
                return Promise.resolve(caller);
              }
              return Promise.resolve(
                target && options.where.id === target.id ? target : null,
              );
            },
          ),
        } as unknown as Repository<Membership>;
      }

      it('rejects a plain project member from logging time for someone else', async () => {
        const membershipsRepo = makeMembershipsRepoFor(
          { id: 'm-1', role: MembershipRole.MEMBER },
          { id: 'm-2' },
        );
        // Their own ProjectMembership exists and they're on the project —
        // irrelevant now, since the org-admin gate rejects them before any
        // project-level tier is consulted.
        const projectMembershipsRepo = makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({ id: 'pm-1', role: 'member' }),
        });
        const service = makeService({
          membershipsRepo,
          projectMembershipsRepo,
        });

        await expect(
          service.createManual('org-1', 'user-1', 'project-1', {
            membershipId: 'm-2',
            startedAt: '2026-01-01T09:00:00.000Z',
            endedAt: '2026-01-01T10:00:00.000Z',
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      // Project-manager tier used to be enough to log for a teammate. The
      // org-admin gate now sits in front of it, so this path is closed to
      // anyone who isn't an org admin, however senior on the project.
      it('rejects a project-manager-tier caller logging time for a teammate', async () => {
        const membershipsRepo = makeMembershipsRepoFor(
          { id: 'm-1', role: MembershipRole.MEMBER },
          { id: 'm-2' },
        );
        const projectMembershipsRepo = makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({ id: 'pm-1', role: 'manager' }),
        });
        const service = makeService({
          membershipsRepo,
          projectMembershipsRepo,
        });

        await expect(
          service.createManual('org-1', 'user-1', 'project-1', {
            membershipId: 'm-2',
            startedAt: '2026-01-01T09:00:00.000Z',
            endedAt: '2026-01-01T10:00:00.000Z',
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      // How an admin fills an untracked gap on a member's timesheet: the
      // entry is attributed to that member, while the audit row records
      // the admin as the actor.
      it('attributes a delegated entry to the target and the audit row to the admin', async () => {
        const membershipsRepo = makeMembershipsRepoFor(
          { id: 'm-admin', role: MembershipRole.ADMIN },
          { id: 'm-2' },
        );
        const projectMembershipsRepo = makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({ id: 'pm-2' }),
        });
        const { auditLogService, record } = makeAuditLogService();
        const service = makeService({
          membershipsRepo,
          projectMembershipsRepo,
          auditLogService,
        });

        const result = await service.createManual(
          'org-1',
          'admin-1',
          'project-1',
          {
            membershipId: 'm-2',
            startedAt: '2026-01-01T09:00:00.000Z',
            endedAt: '2026-01-01T10:00:00.000Z',
          },
        );

        expect(result.membershipId).toBe('m-2');
        expect(record).toHaveBeenCalledTimes(1);
        const call = record.mock.calls[0] as [
          unknown,
          {
            action: string;
            actorUserId: string;
            metadata: { membershipId: string };
          },
        ];
        expect(call[1].action).toBe('time_entry.created_manually');
        expect(call[1].actorUserId).toBe('admin-1');
        expect(call[1].metadata.membershipId).toBe('m-2');
      });

      it('lets an org admin log time for someone else without needing their own ProjectMembership', async () => {
        const membershipsRepo = makeMembershipsRepoFor(
          { id: 'm-admin', role: MembershipRole.ADMIN },
          { id: 'm-2' },
        );
        const projectMembershipsRepo = makeProjectMembershipsRepo({
          // The target's own access check still runs — give them one.
          findOne: jest.fn().mockResolvedValue({ id: 'pm-2' }),
        });
        const service = makeService({
          membershipsRepo,
          projectMembershipsRepo,
        });

        const result = await service.createManual(
          'org-1',
          'admin-1',
          'project-1',
          {
            membershipId: 'm-2',
            startedAt: '2026-01-01T09:00:00.000Z',
            endedAt: '2026-01-01T10:00:00.000Z',
          },
        );

        expect(result.membershipId).toBe('m-2');
      });

      it('rejects logging time for a target who has no access to the project', async () => {
        const membershipsRepo = makeMembershipsRepoFor(
          { id: 'm-admin', role: MembershipRole.ADMIN },
          { id: 'm-2' },
        );
        const projectMembershipsRepo = makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue(null),
        });
        const projectTeamsRepo = makeProjectTeamsRepo(
          jest.fn().mockResolvedValue(null),
        );
        const service = makeService({
          membershipsRepo,
          projectMembershipsRepo,
          projectTeamsRepo,
        });

        await expect(
          service.createManual('org-1', 'admin-1', 'project-1', {
            membershipId: 'm-2',
            startedAt: '2026-01-01T09:00:00.000Z',
            endedAt: '2026-01-01T10:00:00.000Z',
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('rejects a membershipId that names no active membership in the organisation', async () => {
        const membershipsRepo = makeMembershipsRepoFor(
          { id: 'm-1', role: MembershipRole.ADMIN },
          null,
        );
        const service = makeService({ membershipsRepo });

        await expect(
          service.createManual('org-1', 'admin-1', 'project-1', {
            membershipId: 'm-missing',
            startedAt: '2026-01-01T09:00:00.000Z',
            endedAt: '2026-01-01T10:00:00.000Z',
          }),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it("treats membershipId equal to the caller's own as a self-entry, skipping the delegation checks", async () => {
        const membershipsRepo = makeMembershipsRepoFor(
          { id: 'm-1', role: MembershipRole.ADMIN },
          null,
        );
        const projectMembershipsRepo = makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({ id: 'pm-1', role: 'member' }),
        });
        const service = makeService({
          membershipsRepo,
          projectMembershipsRepo,
        });

        const result = await service.createManual(
          'org-1',
          'user-1',
          'project-1',
          {
            membershipId: 'm-1',
            startedAt: '2026-01-01T09:00:00.000Z',
            endedAt: '2026-01-01T10:00:00.000Z',
          },
        );

        expect(result.membershipId).toBe('m-1');
      });
    });
  });

  describe('update', () => {
    /** The entry itself on the first lookup, then nothing — the overlap
     * guard's own `findOne` must not be answered with the entry under edit,
     * or every update would read as clashing with itself. */
    function findEntryThenNoOverlap(entry: Partial<TimeEntry>) {
      return jest.fn().mockResolvedValueOnce(entry).mockResolvedValue(null);
    }

    const completedEntry = {
      id: 'entry-done',
      membershipId: 'm-other',
      projectId: 'project-1',
      taskId: null,
      startedAt: new Date('2026-01-01T09:00:00Z'),
      endedAt: new Date('2026-01-01T10:00:00Z'),
      source: TimeEntrySource.MANUAL,
      deviceId: null,
    } as TimeEntry;

    function makeAdminMembershipsRepo() {
      return makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
      });
    }

    function makeManagerMembershipsRepo() {
      return makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-manager', role: MembershipRole.MANAGER }),
      });
    }

    it('keeps the reason an admin gave on the audit row', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({ ...completedEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        auditLogService,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.update('org-1', 'admin-1', 'entry-done', {
        endedAt: '2026-01-01T11:00:00.000Z',
        reason: 'Forgot to stop timer',
      });

      const call = record.mock.calls[0] as [
        unknown,
        { metadata: { reason?: string } },
      ];
      expect(call[1].metadata.reason).toBe('Forgot to stop timer');
    });

    it("lets an admin edit someone else's entry and records an audit diff", async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({ ...completedEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        auditLogService,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      const result = await service.update('org-1', 'admin-1', 'entry-done', {
        endedAt: '2026-01-01T11:00:00.000Z',
      });

      expect(result.endedAt).toEqual(new Date('2026-01-01T11:00:00.000Z'));
      expect(record).toHaveBeenCalledTimes(1);
      const call = record.mock.calls[0] as [
        unknown,
        { action: string; metadata: { changed: Record<string, unknown> } },
      ];
      expect(call[1].action).toBe('time_entry.updated');
      expect(call[1].metadata.changed).toHaveProperty('endedAt');
    });

    it('lets an admin edit their own entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({
          ...completedEntry,
          membershipId: 'm-admin',
        }),
      });
      const service = makeService({
        timeEntriesRepo,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await expect(
        service.update('org-1', 'admin-1', 'entry-done', {
          endedAt: '2026-01-01T11:00:00.000Z',
        }),
      ).resolves.toMatchObject({
        endedAt: new Date('2026-01-01T11:00:00.000Z'),
      });
    });

    it("rejects a manager editing someone else's entry", async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({ ...completedEntry }),
      });
      const service = makeService({
        timeEntriesRepo,
        membershipsRepo: makeManagerMembershipsRepo(),
      });

      await expect(
        service.update('org-1', 'manager-1', 'entry-done', {
          endedAt: '2026-01-01T11:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a manager editing their own entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...completedEntry, membershipId: 'm-manager' }),
      });
      const service = makeService({
        timeEntriesRepo,
        membershipsRepo: makeManagerMembershipsRepo(),
      });

      await expect(
        service.update('org-1', 'manager-1', 'entry-done', {
          endedAt: '2026-01-01T11:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a plain member editing even their own entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...completedEntry, membershipId: 'm-1' }),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.update('org-1', 'user-1', 'entry-done', {
          endedAt: '2026-01-01T11:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // Shortening an entry strands whatever it captured outside the new span;
    // the window checked is the *old* one, since that is where those
    // captures are.
    it('prunes captures stranded by a moved boundary, against the old span', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({ ...completedEntry }),
      });
      const cleanup = makeCaptureCleanup({ appEvents: 3 });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        auditLogService,
        captureCleanup: cleanup.captureCleanup,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.update('org-1', 'admin-1', 'entry-done', {
        endedAt: '2026-01-01T09:30:00.000Z',
      });

      expect(cleanup.pruneUncovered).toHaveBeenCalledWith(
        expect.anything(),
        'm-other',
        { from: completedEntry.startedAt, to: completedEntry.endedAt },
      );
      const call = record.mock.calls[0] as [
        unknown,
        { metadata: { prunedCaptures?: Record<string, number> } },
      ];
      expect(call[1].metadata.prunedCaptures).toEqual({
        appEvents: 3,
        urlSessions: 0,
        screenshots: 0,
      });
    });

    it('leaves captures alone when only the project changes', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({ ...completedEntry }),
      });
      const cleanup = makeCaptureCleanup();
      const service = makeService({
        timeEntriesRepo,
        captureCleanup: cleanup.captureCleanup,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.update('org-1', 'admin-1', 'entry-done', {
        projectId: 'project-2',
      });

      expect(cleanup.pruneUncovered).not.toHaveBeenCalled();
    });

    // Touching endpoints are adjacency, not overlap — that is exactly what
    // `switch` produces, and blocking it would make switched entries
    // uneditable.
    it("rejects times that overlap another of this person's entries", async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ ...completedEntry })
          .mockResolvedValue({ id: 'other-entry' }),
      });
      const service = makeService({
        timeEntriesRepo,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await expect(
        service.update('org-1', 'admin-1', 'entry-done', {
          endedAt: '2026-01-01T10:30:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('excludes the entry being edited from its own overlap check', async () => {
      const findOne = jest
        .fn()
        .mockResolvedValueOnce({ ...completedEntry })
        .mockResolvedValue(null);
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({ findOne }),
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.update('org-1', 'admin-1', 'entry-done', {
        endedAt: '2026-01-01T10:30:00.000Z',
      });

      const calls = findOne.mock.calls as unknown[][];
      const overlapQuery = calls[1][0] as { where: { id: unknown }[] };
      expect(overlapQuery.where[0].id).toEqual(Not('entry-done'));
    });

    it('is a no-op (no audit entry) when nothing actually changes', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({ ...completedEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        auditLogService,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.update('org-1', 'admin-1', 'entry-done', {
        startedAt: completedEntry.startedAt.toISOString(),
      });

      expect(record).not.toHaveBeenCalled();
    });

    // Paused isn't accruing, so an end just closes it where it left off —
    // and the open pause span is closed at the same instant, exactly as
    // `stop` does, so the break doesn't become worked time.
    it('lets a paused entry be given an end time, closing its open pause', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({
          ...runningEntry,
          membershipId: 'm-admin',
        }),
      });
      const openPause = {
        id: 'pause-1',
        timeEntryId: 'entry-running',
        pausedAt: new Date('2026-01-01T09:30:00Z'),
        resumedAt: null as Date | null,
      };
      const pausesRepo = makeTimeEntryPausesRepo({
        findOne: jest.fn().mockResolvedValue(openPause),
        save: jest.fn().mockResolvedValue(undefined),
      });
      const service = makeService({
        timeEntriesRepo,
        timeEntryPausesRepo: pausesRepo,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      const endedAt = new Date(Date.now() - 60_000).toISOString();
      const result = await service.update('org-1', 'admin-1', 'entry-running', {
        endedAt,
      });

      expect(result.endedAt).toEqual(new Date(endedAt));
      expect(openPause.resumedAt).toEqual(new Date(endedAt));
    });

    it('rejects setting an end time on an entry that is still ticking', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({
          ...runningEntry,
          membershipId: 'm-admin',
        }),
      });
      const service = makeService({
        timeEntriesRepo,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await expect(
        service.update('org-1', 'admin-1', 'entry-running', {
          endedAt: new Date().toISOString(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // Pausing leaves `endedAt` null, so a paused entry reaches `update`
    // looking exactly like a ticking one — and both may have their Project
    // corrected without stopping first.
    it('lets an unstopped entry be moved to another project', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({
          ...runningEntry,
          membershipId: 'm-admin',
        }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        auditLogService,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      const result = await service.update('org-1', 'admin-1', 'entry-running', {
        projectId: 'project-2',
      });

      expect(result.projectId).toBe('project-2');
      expect(result.endedAt).toBeNull();
      const call = record.mock.calls[0] as [
        unknown,
        { metadata: { changed: Record<string, unknown> } },
      ];
      expect(call[1].metadata.changed).toHaveProperty('projectId');
      expect(call[1].metadata.changed).not.toHaveProperty('endedAt');
    });

    it('rejects a start time in the future on an unstopped entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({
          ...runningEntry,
          membershipId: 'm-admin',
        }),
      });
      const service = makeService({
        timeEntriesRepo,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await expect(
        service.update('org-1', 'admin-1', 'entry-running', {
          startedAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws when the entry does not exist', async () => {
      const service = makeService({
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await expect(
        service.update('org-1', 'admin-1', 'nope', {
          endedAt: '2026-01-01T11:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('clears the task when the project changes without an explicit new task', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({
          ...completedEntry,
          taskId: 'task-1',
        }),
      });
      const projectsRepo = makeProjectsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseProject, id: 'project-2' }),
      });
      const service = makeService({
        timeEntriesRepo,
        projectsRepo,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      const result = await service.update('org-1', 'admin-1', 'entry-done', {
        projectId: 'project-2',
      });

      expect(result.projectId).toBe('project-2');
      expect(result.taskId).toBeNull();
    });

    it('rejects changing to an archived project', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: findEntryThenNoOverlap({ ...completedEntry }),
      });
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({
          ...baseProject,
          id: 'project-2',
          archivedAt: new Date(),
        }),
      });
      const service = makeService({
        timeEntriesRepo,
        projectsRepo,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await expect(
        service.update('org-1', 'admin-1', 'entry-done', {
          projectId: 'project-2',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('split', () => {
    const completedEntry = {
      id: 'entry-done',
      membershipId: 'm-other',
      projectId: 'project-1',
      taskId: 'task-9',
      startedAt: new Date('2026-01-01T09:00:00Z'),
      endedAt: new Date('2026-01-01T11:00:00Z'),
      source: TimeEntrySource.AGENT,
      deviceId: 'device-1',
    } as TimeEntry;

    function makeAdminMembershipsRepo() {
      return makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
      });
    }

    function makeSplitService(overrides: { entry?: Partial<TimeEntry> } = {}) {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...completedEntry, ...overrides.entry }),
      });
      const dataSourceParts = makeDataSource();
      const auditParts = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        dataSource: dataSourceParts.dataSource,
        auditLogService: auditParts.auditLogService,
        membershipsRepo: makeAdminMembershipsRepo(),
      });
      return { service, ...dataSourceParts, ...auditParts };
    }

    it('shortens the original to the split point and opens a second half', async () => {
      const { service } = makeSplitService();

      const result = await service.split('org-1', 'admin-1', 'entry-done', {
        at: '2026-01-01T10:00:00.000Z',
      });

      expect(result.first.endedAt).toEqual(new Date('2026-01-01T10:00:00Z'));
      expect(result.second.startedAt).toEqual(new Date('2026-01-01T10:00:00Z'));
      expect(result.second.endedAt).toEqual(new Date('2026-01-01T11:00:00Z'));
    });

    // The second half is the same work by the same person — inheriting the
    // source keeps a tracked span from turning into a "manual" one just
    // because someone cut it.
    it('carries project, task, source and device onto the second half', async () => {
      const { service, manager } = makeSplitService();

      await service.split('org-1', 'admin-1', 'entry-done', {
        at: '2026-01-01T10:00:00.000Z',
      });

      const createCalls = (manager.create as jest.Mock).mock
        .calls as unknown[][];
      const created = createCalls[0][1] as Partial<TimeEntry>;
      expect(created).toMatchObject({
        membershipId: 'm-other',
        projectId: 'project-1',
        taskId: 'task-9',
        source: TimeEntrySource.AGENT,
        deviceId: 'device-1',
      });
    });

    it('records a time_entry.split audit row naming both halves', async () => {
      const { service, record } = makeSplitService();

      await service.split('org-1', 'admin-1', 'entry-done', {
        at: '2026-01-01T10:00:00.000Z',
      });

      const call = record.mock.calls[0] as [
        unknown,
        { action: string; metadata: Record<string, unknown> },
      ];
      expect(call[1].action).toBe('time_entry.split');
      expect(call[1].metadata).toMatchObject({
        timeEntryId: 'entry-done',
        at: new Date('2026-01-01T10:00:00Z'),
        originalEndedAt: new Date('2026-01-01T11:00:00Z'),
      });
      expect(call[1].metadata.newTimeEntryId).toBeDefined();
    });

    it('rejects a split point on the boundary', async () => {
      const { service } = makeSplitService();

      await expect(
        service.split('org-1', 'admin-1', 'entry-done', {
          at: '2026-01-01T09:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a split point outside the entry', async () => {
      const { service } = makeSplitService();

      await expect(
        service.split('org-1', 'admin-1', 'entry-done', {
          at: '2026-01-01T12:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects splitting an entry that has not stopped', async () => {
      const { service } = makeSplitService({ entry: { endedAt: null } });

      await expect(
        service.split('org-1', 'admin-1', 'entry-done', {
          at: '2026-01-01T10:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a non-admin', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.split('org-1', 'user-1', 'entry-done', {
          at: '2026-01-01T10:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    describe('pause spans', () => {
      it('moves a pause that falls wholly after the cut to the second half', async () => {
        const { service, find, manager } = makeSplitService();
        find.mockResolvedValue([
          {
            id: 'pause-1',
            organisationId: 'org-1',
            timeEntryId: 'entry-done',
            pausedAt: new Date('2026-01-01T10:30:00Z'),
            resumedAt: new Date('2026-01-01T10:45:00Z'),
          },
        ]);

        await service.split('org-1', 'admin-1', 'entry-done', {
          at: '2026-01-01T10:00:00.000Z',
        });

        const saveCalls = (manager.save as jest.Mock).mock.calls as unknown[][];
        const moved = saveCalls
          .map((call) => call[0] as { id?: string; timeEntryId?: string })
          .find((saved) => saved.id === 'pause-1');
        expect(moved?.timeEntryId).toBe('entry-2');
      });

      it('leaves a pause that falls wholly before the cut alone', async () => {
        const { service, find, manager } = makeSplitService();
        find.mockResolvedValue([
          {
            id: 'pause-1',
            organisationId: 'org-1',
            timeEntryId: 'entry-done',
            pausedAt: new Date('2026-01-01T09:10:00Z'),
            resumedAt: new Date('2026-01-01T09:20:00Z'),
          },
        ]);

        await service.split('org-1', 'admin-1', 'entry-done', {
          at: '2026-01-01T10:00:00.000Z',
        });

        const saveCalls = (manager.save as jest.Mock).mock.calls as unknown[][];
        const touched = saveCalls
          .map((call) => call[0] as { id?: string })
          .filter((saved) => saved.id === 'pause-1');
        expect(touched).toHaveLength(0);
      });

      // Otherwise one half would report paused time covering minutes it no
      // longer spans, and its duration would come out short.
      it('divides a pause that straddles the cut', async () => {
        const { service, find, manager } = makeSplitService();
        find.mockResolvedValue([
          {
            id: 'pause-1',
            organisationId: 'org-1',
            timeEntryId: 'entry-done',
            pausedAt: new Date('2026-01-01T09:50:00Z'),
            resumedAt: new Date('2026-01-01T10:20:00Z'),
          },
        ]);

        await service.split('org-1', 'admin-1', 'entry-done', {
          at: '2026-01-01T10:00:00.000Z',
        });

        const saveCalls = (manager.save as jest.Mock).mock.calls as unknown[][];
        const original = saveCalls
          .map((call) => call[0] as { id?: string; resumedAt?: Date })
          .find((saved) => saved.id === 'pause-1');
        expect(original?.resumedAt).toEqual(new Date('2026-01-01T10:00:00Z'));

        const createCalls = (manager.create as jest.Mock).mock
          .calls as unknown[][];
        const createdPause = createCalls
          .map((call) => call[1] as { pausedAt?: Date; resumedAt?: Date })
          .find(
            (created) =>
              created.pausedAt?.getTime() ===
              Date.parse('2026-01-01T10:00:00Z'),
          );
        expect(createdPause?.resumedAt).toEqual(
          new Date('2026-01-01T10:20:00Z'),
        );
      });
    });
  });

  describe('remove', () => {
    const completedEntry = {
      id: 'entry-done',
      membershipId: 'm-other',
      projectId: 'project-1',
      taskId: 'task-9',
      startedAt: new Date('2026-01-01T09:00:00Z'),
      endedAt: new Date('2026-01-01T10:00:00Z'),
      source: TimeEntrySource.MANUAL,
      deviceId: null,
    } as TimeEntry;

    function makeAdminMembershipsRepo() {
      return makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
      });
    }

    it("lets an admin delete someone else's entry", async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const { dataSource, remove } = makeDataSource();
      const service = makeService({
        timeEntriesRepo,
        dataSource,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.remove('org-1', 'admin-1', 'entry-done');

      expect(remove).toHaveBeenCalledWith(TimeEntry, { id: 'entry-done' });
    });

    it('lets an admin delete their own entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...completedEntry, membershipId: 'm-admin' }),
      });
      const { dataSource, remove } = makeDataSource();
      const service = makeService({
        timeEntriesRepo,
        dataSource,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.remove('org-1', 'admin-1', 'entry-done');

      expect(remove).toHaveBeenCalledTimes(1);
    });

    // The row is gone after this, so the audit metadata is the only
    // surviving record of what was deleted — it has to be the whole entry,
    // not just its id.
    it('records a time_entry.deleted audit row snapshotting the whole entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        auditLogService,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.remove('org-1', 'admin-1', 'entry-done');

      expect(record).toHaveBeenCalledTimes(1);
      const call = record.mock.calls[0] as [
        unknown,
        {
          action: string;
          actorUserId: string;
          metadata: Record<string, unknown>;
        },
      ];
      expect(call[1].action).toBe('time_entry.deleted');
      expect(call[1].actorUserId).toBe('admin-1');
      expect(call[1].metadata).toEqual({
        timeEntryId: 'entry-done',
        membershipId: 'm-other',
        projectId: 'project-1',
        taskId: 'task-9',
        startedAt: completedEntry.startedAt,
        endedAt: completedEntry.endedAt,
        source: TimeEntrySource.MANUAL,
        deviceId: null,
        prunedCaptures: { appEvents: 0, urlSessions: 0, screenshots: 0 },
      });
    });

    it('deletes and audits inside one transaction', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const { dataSource, transaction } = makeDataSource();
      const service = makeService({
        timeEntriesRepo,
        dataSource,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.remove('org-1', 'admin-1', 'entry-done');

      expect(transaction).toHaveBeenCalledTimes(1);
    });

    it("rejects a manager deleting someone else's entry — deleting is not scoped by role, only by ownership", async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const service = makeService({
        timeEntriesRepo,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({
            id: 'm-manager',
            role: MembershipRole.MANAGER,
          }),
        }),
      });

      await expect(
        service.remove('org-1', 'manager-1', 'entry-done'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // Deleting is deliberately wider than editing: withdrawing your own
    // mistimed entry isn't the same power as rewriting recorded hours, and
    // the audit row keeps the act on record either way.
    it('lets a plain member delete their own entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...completedEntry, membershipId: 'm-1' }),
      });
      const { dataSource, remove } = makeDataSource();
      const service = makeService({ timeEntriesRepo, dataSource });

      await service.remove('org-1', 'user-1', 'entry-done');

      expect(remove).toHaveBeenCalledWith(TimeEntry, { id: 'entry-done' });
    });

    // A plain member can only ever *list* their own timesheet, but that's a
    // read rule — without this the endpoint would take any id from anyone.
    it("rejects a plain member deleting someone else's entry", async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.remove('org-1', 'user-1', 'entry-done'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // Hard delete frees the one-running-timer slot along with the row, so
    // there's nothing to protect against here — a bogus running or paused
    // entry can simply go.
    it('deletes a still-running entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...completedEntry, endedAt: null }),
      });
      const { dataSource, remove } = makeDataSource();
      const service = makeService({
        timeEntriesRepo,
        dataSource,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.remove('org-1', 'admin-1', 'entry-done');

      expect(remove).toHaveBeenCalledWith(TimeEntry, { id: 'entry-done' });
    });

    it('404s on an unknown entry', async () => {
      const service = makeService({
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await expect(
        service.remove('org-1', 'admin-1', 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // Capture only runs because a timer is running, so activity recorded
    // for an entry that turned out to be wrong is wrong too.
    it('prunes the captures the deleted entry used to cover', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const cleanup = makeCaptureCleanup({
        appEvents: 12,
        screenshots: 2,
        storageKeys: ['shots/a.jpg', 'shots/b.jpg'],
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        auditLogService,
        captureCleanup: cleanup.captureCleanup,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.remove('org-1', 'admin-1', 'entry-done');

      expect(cleanup.pruneUncovered).toHaveBeenCalledWith(
        expect.anything(),
        'm-other',
        { from: completedEntry.startedAt, to: completedEntry.endedAt },
      );
      const call = record.mock.calls[0] as [
        unknown,
        { metadata: { prunedCaptures: Record<string, number> } },
      ];
      expect(call[1].metadata.prunedCaptures).toEqual({
        appEvents: 12,
        urlSessions: 0,
        screenshots: 2,
      });
    });

    // Object storage can't roll back, so the objects go only once the rows
    // are safely committed.
    it('deletes screenshot objects after the transaction, never inside it', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const cleanup = makeCaptureCleanup({ storageKeys: ['shots/a.jpg'] });
      const service = makeService({
        timeEntriesRepo,
        captureCleanup: cleanup.captureCleanup,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.remove('org-1', 'admin-1', 'entry-done');

      expect(cleanup.deleteStoredObjects).toHaveBeenCalledWith(['shots/a.jpg']);
      expect(
        cleanup.deleteStoredObjects.mock.invocationCallOrder[0],
      ).toBeGreaterThan(cleanup.pruneUncovered.mock.invocationCallOrder[0]);
    });

    it('keeps the deletion reason on the audit row when one is given', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        auditLogService,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.remove('org-1', 'admin-1', 'entry-done', {
        reason: 'Forgot to stop timer',
      });

      const call = record.mock.calls[0] as [
        unknown,
        { metadata: { reason?: string } },
      ];
      expect(call[1].metadata.reason).toBe('Forgot to stop timer');
    });

    // Batch delete removes many at once with nowhere to ask per entry, so
    // the field has to stay absent rather than be recorded empty.
    it('omits the reason entirely when none is given', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        auditLogService,
        membershipsRepo: makeAdminMembershipsRepo(),
      });

      await service.remove('org-1', 'admin-1', 'entry-done');

      const call = record.mock.calls[0] as [
        unknown,
        { metadata: Record<string, unknown> },
      ];
      expect(call[1].metadata).not.toHaveProperty('reason');
    });
  });

  describe('switchTo', () => {
    it('stops the running entry and starts a new one in the same transaction', async () => {
      const { dataSource, manager } = makeDataSource();
      (manager.findOne as jest.Mock).mockResolvedValue({ ...runningEntry });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ dataSource, auditLogService });

      const result = await service.switchTo(
        'org-1',
        'user-1',
        'project-1',
        undefined,
        TimeEntrySource.WEB,
        null,
      );

      expect(result.endedAt).toBeNull();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.stopped' }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.started' }),
      );
    });

    it('just starts a new timer when nothing was running', async () => {
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ dataSource, auditLogService });

      await service.switchTo(
        'org-1',
        'user-1',
        'project-1',
        undefined,
        TimeEntrySource.WEB,
        null,
      );

      expect(record).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.stopped' }),
      );
    });
  });

  describe('pause', () => {
    // A Time entry is one unbroken span now: pausing ends it, and pressing
    // play starts another. The hole-in-an-entry model made Duration
    // disagree with the Start-End shown beside it.
    it('ends the running entry, recording itself as a pause', async () => {
      const save = jest.fn((entry: unknown) => Promise.resolve(entry));
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
        save,
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ timeEntriesRepo, auditLogService });

      const result = await service.pause('org-1', 'user-1', null);

      expect(result.endedAt).not.toBeNull();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.paused' }),
      );
    });

    it('writes no pause span at all', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
        }),
        timeEntryPausesRepo: makeTimeEntryPausesRepo({ save }),
      });

      await service.pause('org-1', 'user-1', null);

      expect(save).not.toHaveBeenCalled();
    });

    it('throws when nothing is running on this device', async () => {
      const service = makeService();

      await expect(
        service.pause('org-1', 'user-1', null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resume', () => {
    // Nothing to resume any more, so this starts a fresh entry on whatever
    // the device last tracked — kept so an agent that has not updated, and
    // still calls pause then resume, keeps working.
    it('starts a new entry on the last project tracked', async () => {
      const findOne = jest
        .fn()
        // No running entry…
        .mockResolvedValueOnce(null)
        // …so it falls back to the most recently stopped one.
        .mockResolvedValueOnce({
          ...runningEntry,
          projectId: 'project-1',
          endedAt: new Date('2026-01-01T10:00:00.000Z'),
        })
        .mockResolvedValue(null);
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          findOne,
          find: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.resume('org-1', 'user-1', null);

      expect(result.projectId).toBe('project-1');
      expect(result.endedAt).toBeNull();
    });

    it('answers with the running entry when one already is', async () => {
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
        }),
      });

      const result = await service.resume('org-1', 'user-1', null);

      expect(result.id).toBe('entry-running');
    });

    it('throws when the device has never tracked anything', async () => {
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.resume('org-1', 'user-1', null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('current', () => {
    it('returns null and the server clock when nothing is running', async () => {
      const service = makeService();

      const result = await service.current('org-1', 'user-1', null);

      expect(result.entry).toBeNull();
      expect(result.now).toBeInstanceOf(Date);
    });

    it('returns the running entry when one exists', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue(runningEntry),
      });
      const service = makeService({ timeEntriesRepo });

      const result = await service.current('org-1', 'user-1', null);

      expect(result.entry?.id).toBe('entry-running');
    });
  });

  describe('list', () => {
    it('resolves project/task names and computes duration for a completed entry', async () => {
      const completedEntry = {
        id: 'entry-done',
        membershipId: 'm-1',
        projectId: 'project-1',
        taskId: 'task-1',
        startedAt: new Date('2026-01-01T09:00:00Z'),
        endedAt: new Date('2026-01-01T09:30:15Z'),
        source: TimeEntrySource.WEB,
        deviceId: null,
        project: { name: 'Website', colour: 'blue' },
        task: { name: 'Design homepage' },
      } as unknown as TimeEntry;
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([completedEntry]),
      });
      const service = makeService({ timeEntriesRepo });

      const result = await service.list('org-1', 'user-1');

      expect(result).toEqual([
        expect.objectContaining({
          id: 'entry-done',
          projectName: 'Website',
          projectColour: 'blue',
          taskName: 'Design homepage',
          durationSeconds: 1815,
        }),
      ]);
    });

    it('subtracts closed pause spans from durationSeconds', async () => {
      const completedEntry = {
        id: 'entry-done',
        membershipId: 'm-1',
        projectId: 'project-1',
        taskId: 'task-1',
        startedAt: new Date('2026-01-01T09:00:00Z'),
        endedAt: new Date('2026-01-01T09:30:00Z'),
        source: TimeEntrySource.WEB,
        deviceId: null,
        project: { name: 'Website', colour: 'blue' },
        task: { name: 'Design homepage' },
      } as unknown as TimeEntry;
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([completedEntry]),
      });
      const timeEntryPausesRepo = makeTimeEntryPausesRepo({
        find: jest.fn().mockResolvedValue([
          {
            id: 'pause-1',
            timeEntryId: 'entry-done',
            pausedAt: new Date('2026-01-01T09:10:00Z'),
            resumedAt: new Date('2026-01-01T09:15:00Z'),
          } as TimeEntryPause,
        ]),
      });
      const service = makeService({ timeEntriesRepo, timeEntryPausesRepo });

      const result = await service.list('org-1', 'user-1');

      // 30 minutes total, minus a 5 minute pause span = 25 minutes.
      expect(result[0].durationSeconds).toBe(25 * 60);
    });

    it('exposes every pause span (closed and open) on the list item, oldest first', async () => {
      const completedEntry = {
        id: 'entry-done',
        membershipId: 'm-1',
        projectId: 'project-1',
        taskId: 'task-1',
        startedAt: new Date('2026-01-01T09:00:00Z'),
        endedAt: new Date('2026-01-01T12:00:00Z'),
        source: TimeEntrySource.WEB,
        deviceId: null,
        project: { name: 'Website', colour: 'blue' },
        task: { name: 'Design homepage' },
      } as unknown as TimeEntry;
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([completedEntry]),
      });
      const timeEntryPausesRepo = makeTimeEntryPausesRepo({
        find: jest.fn().mockResolvedValue([
          {
            id: 'pause-2',
            timeEntryId: 'entry-done',
            pausedAt: new Date('2026-01-01T11:00:00Z'),
            resumedAt: new Date('2026-01-01T11:10:00Z'),
          } as TimeEntryPause,
          {
            id: 'pause-1',
            timeEntryId: 'entry-done',
            pausedAt: new Date('2026-01-01T09:10:00Z'),
            resumedAt: new Date('2026-01-01T09:15:00Z'),
          } as TimeEntryPause,
        ]),
      });
      const service = makeService({ timeEntriesRepo, timeEntryPausesRepo });

      const result = await service.list('org-1', 'user-1');

      expect(result[0].pauses).toEqual([
        {
          pausedAt: new Date('2026-01-01T09:10:00Z'),
          resumedAt: new Date('2026-01-01T09:15:00Z'),
        },
        {
          pausedAt: new Date('2026-01-01T11:00:00Z'),
          resumedAt: new Date('2026-01-01T11:10:00Z'),
        },
      ]);
    });

    it('returns an empty pauses array for an entry that was never paused', async () => {
      const completedEntry = {
        id: 'entry-done',
        membershipId: 'm-1',
        projectId: 'project-1',
        taskId: 'task-1',
        startedAt: new Date('2026-01-01T09:00:00Z'),
        endedAt: new Date('2026-01-01T09:30:00Z'),
        source: TimeEntrySource.WEB,
        deviceId: null,
        project: { name: 'Website', colour: 'blue' },
        task: { name: 'Design homepage' },
      } as unknown as TimeEntry;
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([completedEntry]),
      });
      const service = makeService({ timeEntriesRepo });

      const result = await service.list('org-1', 'user-1');

      expect(result[0].pauses).toEqual([]);
    });

    it('leaves durationSeconds null for a still-running entry', async () => {
      const runningWithRelations = {
        ...runningEntry,
        project: { name: 'Website', colour: 'blue' },
        task: null,
      } as unknown as TimeEntry;
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([runningWithRelations]),
      });
      const service = makeService({ timeEntriesRepo });

      const result = await service.list('org-1', 'user-1');

      expect(result[0].durationSeconds).toBeNull();
      expect(result[0].taskName).toBeNull();
    });

    it('rejects a caller with no active organisation membership', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(service.list('org-1', 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('filters by startedAt between from and to when both are given', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const timeEntriesRepo = makeTimeEntriesRepo({ find });
      const service = makeService({ timeEntriesRepo });
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-01-01T23:59:59.999Z');

      await service.list('org-1', 'user-1', undefined, from, to);

      const call = find.mock.calls[0] as [{ where: { startedAt: unknown } }];
      expect(call[0].where.startedAt).toEqual(Between(from, to));
    });

    it('applies no date filter when neither from nor to is given', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const timeEntriesRepo = makeTimeEntriesRepo({ find });
      const service = makeService({ timeEntriesRepo });

      await service.list('org-1', 'user-1');

      const call = find.mock.calls[0] as [{ where: Record<string, unknown> }];
      expect(call[0].where).not.toHaveProperty('startedAt');
    });

    it('marks canEdit false for a plain member viewing their own entries', async () => {
      const ownEntry = {
        id: 'entry-1',
        membershipId: 'm-1',
        projectId: 'project-1',
        taskId: null,
        startedAt: new Date('2026-01-01T09:00:00Z'),
        endedAt: new Date('2026-01-01T10:00:00Z'),
        source: TimeEntrySource.WEB,
        deviceId: null,
        project: { name: 'Website', colour: 'blue' },
        task: null,
      } as unknown as TimeEntry;
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([ownEntry]),
      });
      const service = makeService({ timeEntriesRepo });

      const result = await service.list('org-1', 'user-1');

      expect(result[0].canEdit).toBe(false);
    });

    it('marks canEdit true for an admin viewing their own entries', async () => {
      const ownEntry = {
        id: 'entry-1',
        membershipId: 'm-admin',
        projectId: 'project-1',
        taskId: null,
        startedAt: new Date('2026-01-01T09:00:00Z'),
        endedAt: new Date('2026-01-01T10:00:00Z'),
        source: TimeEntrySource.WEB,
        deviceId: null,
        project: { name: 'Website', colour: 'blue' },
        task: null,
      } as unknown as TimeEntry;
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([ownEntry]),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
      });
      const service = makeService({ timeEntriesRepo, membershipsRepo });

      const result = await service.list('org-1', 'admin-1');

      expect(result[0].canEdit).toBe(true);
    });

    /** Answers the caller lookup (by userId) with `callerId`, and any lookup by id with that member. */
    function membersById(
      members: Record<string, object>,
      callerId = 'm-admin',
    ) {
      return makeMembershipsRepo({
        findOne: jest.fn(
          (query: { where: { userId?: string; id?: string } }) => {
            const id = query.where.userId ? callerId : query.where.id!;
            return Promise.resolve(
              members[id] ? { id, teamMemberships: [], ...members[id] } : null,
            );
          },
        ),
      });
    }

    it("lets an admin view another member's timesheet by membershipId", async () => {
      const otherEntry = {
        id: 'entry-1',
        membershipId: 'm-other',
        projectId: 'project-1',
        taskId: null,
        startedAt: new Date('2026-01-01T09:00:00Z'),
        endedAt: new Date('2026-01-01T10:00:00Z'),
        source: TimeEntrySource.WEB,
        deviceId: null,
        project: { name: 'Website', colour: 'blue' },
        task: null,
      } as unknown as TimeEntry;
      const find = jest.fn().mockResolvedValue([otherEntry]);
      const timeEntriesRepo = makeTimeEntriesRepo({ find });
      const membershipsRepo = membersById({
        'm-admin': { role: MembershipRole.ADMIN },
        'm-other': { role: MembershipRole.MEMBER },
      });
      const service = makeService({ timeEntriesRepo, membershipsRepo });

      const result = await service.list('org-1', 'admin-1', 'm-other');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { membershipId: 'm-other' } }),
      );
      expect(result[0].canEdit).toBe(true);
    });

    it('lets a manager view the timesheet of someone on a team they manage', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({ find }),
        membershipsRepo: membersById(
          {
            'm-manager': {
              role: MembershipRole.MANAGER,
              teamMemberships: [{ teamId: 'team-a', isManager: true }],
            },
            'm-other': {
              role: MembershipRole.MEMBER,
              teamMemberships: [{ teamId: 'team-a', isManager: false }],
            },
          },
          'm-manager',
        ),
      });

      await service.list('org-1', 'manager-1', 'm-other');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { membershipId: 'm-other' } }),
      );
    });

    it('refuses a manager the timesheet of someone outside their teams', async () => {
      const service = makeService({
        membershipsRepo: membersById(
          {
            'm-manager': {
              role: MembershipRole.MANAGER,
              teamMemberships: [{ teamId: 'team-a', isManager: true }],
            },
            'm-other': {
              role: MembershipRole.MEMBER,
              teamMemberships: [{ teamId: 'team-b', isManager: false }],
            },
          },
          'm-manager',
        ),
      });

      await expect(
        service.list('org-1', 'manager-1', 'm-other'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects a plain member trying to view another member's timesheet", async () => {
      const service = makeService();

      await expect(
        service.list('org-1', 'user-1', 'm-other'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('activity level on listed entries', () => {
    function makeSample(
      periodStart: string,
      periodEnd: string,
      activePercentage: number,
    ): ActivitySample {
      return {
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        activePercentage,
      } as ActivitySample;
    }

    function listWith(samples: ActivitySample[], entry: Partial<TimeEntry>) {
      const listed = {
        id: 'entry-1',
        membershipId: 'm-1',
        projectId: 'project-1',
        taskId: null,
        startedAt: new Date('2026-01-05T09:00:00Z'),
        endedAt: new Date('2026-01-05T10:00:00Z'),
        source: TimeEntrySource.AGENT,
        deviceId: null,
        project: { name: 'Website', colour: 'blue' },
        task: null,
        ...entry,
      } as unknown as TimeEntry;
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          find: jest.fn().mockResolvedValue([listed]),
        }),
        activitySamplesRepo: makeActivitySamplesRepo(samples),
      });
      return service.list('org-1', 'user-1');
    }

    it('averages the samples covering an entry', async () => {
      const result = await listWith(
        [
          makeSample('2026-01-05T09:00:00Z', '2026-01-05T09:30:00Z', 40),
          makeSample('2026-01-05T09:30:00Z', '2026-01-05T10:00:00Z', 80),
        ],
        {},
      );

      expect(result[0].activePercentage).toBe(60);
    });

    // Sample periods are fixed 10-minute blocks and rarely line up with an
    // entry, so one half outside it should count half.
    it('weights a sample by how much of it falls inside the entry', async () => {
      const result = await listWith(
        [
          makeSample('2026-01-05T08:00:00Z', '2026-01-05T09:30:00Z', 0),
          makeSample('2026-01-05T09:30:00Z', '2026-01-05T10:00:00Z', 100),
        ],
        {},
      );

      // 30 min at 0% and 30 min at 100%, not 90 min at 0% and 30 at 100%.
      expect(result[0].activePercentage).toBe(50);
    });

    // Null, not 0 — "nothing was measured" is a different claim from "they
    // did nothing".
    it('reports null when no sample covers the entry', async () => {
      const result = await listWith(
        [makeSample('2026-01-05T14:00:00Z', '2026-01-05T14:10:00Z', 90)],
        {},
      );

      expect(result[0].activePercentage).toBeNull();
    });

    it('reports null for an entry that has not stopped', async () => {
      const result = await listWith(
        [makeSample('2026-01-05T09:00:00Z', '2026-01-05T09:10:00Z', 90)],
        { endedAt: null },
      );

      expect(result[0].activePercentage).toBeNull();
    });
  });

  describe('listCoveringWindow', () => {
    function makeQueryBuilderRepo(rows: unknown[] = []) {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      const createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
      const repo = {
        createQueryBuilder,
      } as unknown as Repository<TimeEntry>;
      return { repo, queryBuilder, createQueryBuilder };
    }

    it('queries overlap (not containment) scoped to the org and membership', async () => {
      const { repo, queryBuilder, createQueryBuilder } = makeQueryBuilderRepo();
      const service = makeService({ timeEntriesRepo: repo });
      const start = new Date('2026-01-05T00:00:00.000Z');
      const end = new Date('2026-01-06T00:00:00.000Z');

      await service.listCoveringWindow('org-1', 'm-1', start, end);

      expect(createQueryBuilder).toHaveBeenCalledWith('entry');
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'entry.organisationId = :organisationId',
        { organisationId: 'org-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'entry.membershipId = :membershipId',
        { membershipId: 'm-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'entry.startedAt < :end',
        { end },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(entry.endedAt IS NULL OR entry.endedAt > :start)',
        { start },
      );
    });

    it('returns the rows from the query builder', async () => {
      const rows = [
        { id: 'e-1', projectId: 'p-1', startedAt: new Date(), endedAt: null },
      ];
      const { repo } = makeQueryBuilderRepo(rows);
      const service = makeService({ timeEntriesRepo: repo });

      const result = await service.listCoveringWindow(
        'org-1',
        'm-1',
        new Date('2026-01-05T00:00:00.000Z'),
        new Date('2026-01-06T00:00:00.000Z'),
      );

      expect(result).toBe(rows);
    });
  });

  describe('hasRunningEntryForProject', () => {
    it('returns true when a running entry exists for the project', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue(runningEntry),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.hasRunningEntryForProject('project-1'),
      ).resolves.toBe(true);
    });

    it('returns false when none exists', async () => {
      const service = makeService();

      await expect(
        service.hasRunningEntryForProject('project-1'),
      ).resolves.toBe(false);
    });
  });

  describe('closeEntriesFromDevicesThatWentAway', () => {
    /** Only what the closer touches: the entry, and a transaction to save it. */
    function openEntry(startedAt: Date): TimeEntry {
      return {
        id: 'entry-abandoned',
        organisationId: 'org-1',
        membershipId: 'm-1',
        projectId: 'project-1',
        taskId: null,
        startedAt,
        endedAt: null,
        source: TimeEntrySource.AGENT,
        deviceId: 'device-1',
      } as TimeEntry;
    }

    function transactionOver(entry: TimeEntry) {
      const saved = { ...entry };
      const deleted: unknown[] = [];
      const manager = {
        findOne: jest.fn().mockResolvedValue(saved),
        delete: jest.fn((_entity: unknown, criteria: unknown) => {
          deleted.push(criteria);
          return Promise.resolve({ affected: 1 });
        }),
        save: jest.fn((row: TimeEntry) => {
          Object.assign(saved, row);
          return Promise.resolve(saved);
        }),
        getRepository: jest.fn(() => ({
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn(),
        })),
      };
      return {
        saved,
        deleted,
        dataSource: {
          transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
        },
      };
    }

    /** An entry still open, on a device last heard from at `lastSeenAt`. */
    function abandoned(startedAt: Date, lastSeenAt: Date) {
      const entry = openEntry(startedAt);
      return {
        entry,
        repo: makeTimeEntriesRepo({
          createQueryBuilder: jest.fn(() => ({
            innerJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getRawAndEntities: jest.fn().mockResolvedValue({
              entities: [entry],
              raw: [{ device_lastSeenAt: lastSeenAt }],
            }),
          })),
        } as unknown as Partial<Repository<TimeEntry>>),
      };
    }

    /**
     * The reported case: worked from 18:51, suspended the machine, opened
     * the app again at 09:51 the next morning — and the timesheet billed the
     * night. The closing stop never reached the server, so nothing ended it.
     */
    it('ends the entry where the device was last heard from', async () => {
      const startedAt = new Date('2026-10-08T15:51:00.000Z');
      const lastSeenAt = new Date('2026-10-08T15:51:40.000Z');
      const { entry, repo } = abandoned(startedAt, lastSeenAt);
      const tx = transactionOver(entry);
      const service = makeService({
        timeEntriesRepo: repo,
        dataSource: tx.dataSource,
      });

      await service.closeEntriesFromDevicesThatWentAway(
        new Date('2026-10-09T06:51:00.000Z'),
      );

      expect(tx.saved.endedAt).toEqual(lastSeenAt);
    });

    /**
     * What the split leaves behind when it carries an abandoned timer past
     * midnight: a half that begins hours after the machine went. It holds no
     * worked time and never did, so it is removed rather than kept as a
     * zero-length record of nothing.
     */
    it('removes an entry that began after its device went', async () => {
      const startedAt = new Date('2026-10-09T00:00:00.000Z'); // the boundary
      const { entry, repo } = abandoned(
        startedAt,
        new Date('2026-10-08T15:51:40.000Z'),
      );
      const tx = transactionOver(entry);
      const service = makeService({
        timeEntriesRepo: repo,
        dataSource: tx.dataSource,
      });

      await service.closeEntriesFromDevicesThatWentAway(
        new Date('2026-10-09T06:51:00.000Z'),
      );

      expect(tx.deleted).toEqual([{ id: 'entry-abandoned' }]);
      expect(tx.saved.endedAt).toBeNull();
    });

    /**
     * Ordering matters: the split would otherwise carry the entry past
     * midnight, and the half after it starts later than the device was last
     * seen — so there would be no honest instant left to end it at.
     */
    it('runs before the day-boundary split', async () => {
      const startedAt = new Date('2026-10-08T15:51:00.000Z');
      const lastSeenAt = new Date('2026-10-08T15:51:40.000Z');
      const { entry, repo } = abandoned(startedAt, lastSeenAt);
      const tx = transactionOver(entry);
      const service = makeService({
        timeEntriesRepo: repo,
        dataSource: tx.dataSource,
      });
      const closer = jest.spyOn(service, 'closeEntriesFromDevicesThatWentAway');

      await service.splitRunningEntriesAcrossDayBoundary();

      expect(closer).toHaveBeenCalled();
      expect(tx.saved.endedAt).toEqual(lastSeenAt);
    });
  });

  describe('splitRunningEntriesAcrossDayBoundary', () => {
    // A hand-rolled fake transaction/manager backed by a plain in-memory
    // map — the shared `makeDataSource()` helper always resolves `findOne`
    // to a single fixed value, but this method re-fetches fresh state once
    // per day boundary crossed (potentially several times per entry), so it
    // needs a manager that actually reflects prior saves within the test.
    function makeFakeDataSource(
      initialEntries: TimeEntry[],
      initialPauses: TimeEntryPause[] = [],
    ) {
      const entries = new Map(initialEntries.map((e) => [e.id, { ...e }]));
      const pauses = new Map(initialPauses.map((p) => [p.id, { ...p }]));
      let nextId = 1;

      const pausesRepo = {
        findOne: jest.fn(
          ({
            where,
          }: {
            where: { timeEntryId: string; resumedAt: unknown };
          }) => {
            for (const pause of pauses.values()) {
              if (
                pause.timeEntryId === where.timeEntryId &&
                pause.resumedAt === null
              ) {
                return Promise.resolve(pause);
              }
            }
            return Promise.resolve(null);
          },
        ),
        save: jest.fn((pause: TimeEntryPause) => {
          const id = pause.id ?? `pause-${nextId++}`;
          const saved = { ...pause, id };
          pauses.set(id, saved);
          return Promise.resolve(saved);
        }),
        create: jest.fn(
          (input: Partial<TimeEntryPause>) => input as TimeEntryPause,
        ),
      };

      const manager = {
        findOne: jest.fn(
          (_entity: unknown, { where }: { where: { id: string } }) => {
            const found = entries.get(where.id);
            return Promise.resolve(found ? { ...found } : null);
          },
        ),
        save: jest.fn((entity: TimeEntry) => {
          const id = entity.id ?? `entry-${nextId++}`;
          const saved = { ...entity, id };
          entries.set(id, saved);
          return Promise.resolve(saved);
        }),
        create: jest.fn(
          (_entity: unknown, input: Partial<TimeEntry>) => input as TimeEntry,
        ),
        getRepository: jest.fn().mockReturnValue(pausesRepo),
      };

      const transaction = jest.fn(
        (fn: (manager: typeof manager) => Promise<unknown>) => fn(manager),
      );

      return { dataSource: { transaction } as unknown, entries, pauses };
    }

    function makeRunningEntry(
      overrides: Partial<TimeEntry> & { id: string; startedAt: Date },
    ): TimeEntry {
      return {
        organisationId: 'org-1',
        membershipId: 'm-1',
        projectId: 'project-1',
        taskId: 'task-1',
        endedAt: null,
        source: TimeEntrySource.WEB,
        deviceId: null,
        ...overrides,
      } as TimeEntry;
    }

    afterEach(() => {
      jest.useRealTimers();
    });

    it('closes an overnight entry at local midnight and opens a new one for today', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-06T10:00:00.000Z'));
      const original = makeRunningEntry({
        id: 'entry-orig',
        startedAt: new Date('2026-01-05T09:00:00.000Z'),
      });
      const fake = makeFakeDataSource([original]);
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([original]),
      });
      const service = makeService({
        timeEntriesRepo,
        dataSource: fake.dataSource,
      });

      await service.splitRunningEntriesAcrossDayBoundary();

      const oldEntry = fake.entries.get('entry-orig')!;
      expect(oldEntry.endedAt).toEqual(new Date('2026-01-06T00:00:00.000Z'));

      const newEntries = [...fake.entries.values()].filter(
        (e) => e.id !== 'entry-orig',
      );
      expect(newEntries).toHaveLength(1);
      expect(newEntries[0]).toMatchObject({
        startedAt: new Date('2026-01-06T00:00:00.000Z'),
        endedAt: null,
        projectId: 'project-1',
        taskId: 'task-1',
        membershipId: 'm-1',
      });
    });

    it('catches a multi-day-old entry fully up in one call', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-08T12:00:00.000Z'));
      const original = makeRunningEntry({
        id: 'entry-orig',
        startedAt: new Date('2026-01-05T09:00:00.000Z'),
      });
      const fake = makeFakeDataSource([original]);
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([original]),
      });
      const service = makeService({
        timeEntriesRepo,
        dataSource: fake.dataSource,
      });

      await service.splitRunningEntriesAcrossDayBoundary();

      // Jan 5 -> Jan 6 -> Jan 7 -> Jan 8 (today, still open) — 3 splits.
      expect(fake.entries.size).toBe(4);
      const stillOpen = [...fake.entries.values()].find(
        (e) => e.endedAt === null,
      );
      expect(stillOpen?.startedAt).toEqual(
        new Date('2026-01-08T00:00:00.000Z'),
      );
    });

    /**
     * The 3:00 AM bug. Production runs UTC, so splitting at the *server's*
     * midnight cut an EAT team's day at 03:00 local and left everyone with
     * an entry starting at an hour they had not worked.
     */
    it("cuts at the organisation's midnight, not the server's", async () => {
      // 10:00 UTC, well past both midnights.
      jest.useFakeTimers().setSystemTime(new Date('2026-01-06T10:00:00.000Z'));
      const original = makeRunningEntry({
        id: 'entry-orig',
        startedAt: new Date('2026-01-05T09:00:00.000Z'),
      });
      const fake = makeFakeDataSource([original], []);
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          find: jest.fn().mockResolvedValue([original]),
        }),
        // Africa/Nairobi is UTC+3, so its midnight is 21:00 UTC the day
        // before — three hours earlier than the server's.
        organisationsRepo: makeOrganisationsRepo('Africa/Nairobi'),
        dataSource: fake.dataSource,
      });

      await service.splitRunningEntriesAcrossDayBoundary();

      const next = [...fake.entries.values()].find(
        (e) => e.id !== 'entry-orig',
      )!;
      expect(next.startedAt.toISOString()).toBe('2026-01-05T21:00:00.000Z');
    });

    // Pausing ends an entry now, so no open pause can reach midnight. The
    // splitter used to close one at the boundary and open another on the
    // new entry, which manufactured rows holding nothing but a pause.
    it('leaves pause spans alone entirely', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-06T10:00:00.000Z'));
      const original = makeRunningEntry({
        id: 'entry-orig',
        startedAt: new Date('2026-01-05T09:00:00.000Z'),
      });
      const fake = makeFakeDataSource([original], []);
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({
          find: jest.fn().mockResolvedValue([original]),
        }),
        dataSource: fake.dataSource,
      });

      await service.splitRunningEntriesAcrossDayBoundary();

      expect(fake.pauses.size).toBe(0);
      expect([...fake.entries.values()]).toHaveLength(2);
    });

    it('still splits into a positive-duration entry when startedAt is already exactly a previous midnight', async () => {
      // The steady-state shape this job's own output takes the night after
      // it first runs.
      jest.useFakeTimers().setSystemTime(new Date('2026-01-07T08:00:00.000Z'));
      const original = makeRunningEntry({
        id: 'entry-orig',
        startedAt: new Date('2026-01-06T00:00:00.000Z'),
      });
      const fake = makeFakeDataSource([original]);
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([original]),
      });
      const service = makeService({
        timeEntriesRepo,
        dataSource: fake.dataSource,
      });

      await service.splitRunningEntriesAcrossDayBoundary();

      const oldEntry = fake.entries.get('entry-orig')!;
      expect(oldEntry.endedAt).toEqual(new Date('2026-01-07T00:00:00.000Z'));
      expect(oldEntry.endedAt!.getTime()).toBeGreaterThan(
        oldEntry.startedAt.getTime(),
      );
    });

    it('leaves an entry that started today untouched', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-06T15:00:00.000Z'));
      const original = makeRunningEntry({
        id: 'entry-today',
        startedAt: new Date('2026-01-06T09:00:00.000Z'),
      });
      const fake = makeFakeDataSource([original]);
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([original]),
      });
      const service = makeService({
        timeEntriesRepo,
        dataSource: fake.dataSource,
      });

      await service.splitRunningEntriesAcrossDayBoundary();

      expect(fake.entries.size).toBe(1);
      const entry = fake.entries.get('entry-today')!;
      expect(entry.endedAt).toBeNull();
    });
  });
});
