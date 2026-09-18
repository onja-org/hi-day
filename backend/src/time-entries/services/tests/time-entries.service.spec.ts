import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Between, EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { Project } from '../../../database/entities/project.entity';
import { ProjectMembership } from '../../../database/entities/project-membership.entity';
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
    const manager = {
      save: jest.fn((input: Partial<TimeEntry>) =>
        Promise.resolve({ id: 'entry-2', ...input } as TimeEntry),
      ),
      create: jest.fn((_entity: unknown, input: Partial<TimeEntry>) => input),
      findOne: jest.fn().mockResolvedValue(null),
      getRepository: jest.fn().mockReturnValue(pausesRepo),
    } as unknown as EntityManager;
    const transaction = jest.fn(
      (fn: (manager: EntityManager) => Promise<unknown>) => fn(manager),
    );
    return {
      dataSource: { transaction } as unknown,
      transaction,
      save,
      manager,
    };
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  function makeService(
    overrides: {
      timeEntriesRepo?: Repository<TimeEntry>;
      timeEntryPausesRepo?: Repository<TimeEntryPause>;
      membershipsRepo?: Repository<Membership>;
      projectMembershipsRepo?: Repository<ProjectMembership>;
      projectTeamsRepo?: Repository<ProjectTeam>;
      projectsRepo?: Repository<Project>;
      tasksRepo?: Repository<Task>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new TimeEntriesService(
      overrides.timeEntriesRepo ?? makeTimeEntriesRepo(),
      overrides.timeEntryPausesRepo ?? makeTimeEntryPausesRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      overrides.projectMembershipsRepo ?? makeProjectMembershipsRepo(),
      overrides.projectTeamsRepo ?? makeProjectTeamsRepo(),
      overrides.projectsRepo ?? makeProjectsRepo(),
      overrides.tasksRepo ?? makeTasksRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
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

    it('rejects with a 409 carrying the running entry when one is already running', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue(runningEntry),
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

  describe('stop', () => {
    it('stops the running timer and records an audit log entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ timeEntriesRepo, auditLogService });

      const result = await service.stop('org-1', 'user-1');

      expect(result.endedAt).not.toBeNull();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.stopped' }),
      );
    });

    it('throws when no timer is running', async () => {
      const service = makeService();

      await expect(service.stop('org-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('backdates the stop when given an explicit endedAt, and notes it was idle-discarded', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ timeEntriesRepo, auditLogService });
      const backdatedEndedAt = new Date(Date.now() - 60_000);

      const result = await service.stop('org-1', 'user-1', backdatedEndedAt);

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
        service.stop('org-1', 'user-1', new Date('2025-12-31T00:00:00Z')),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a stop dated in the future', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(
        service.stop('org-1', 'user-1', new Date(Date.now() + 60_000)),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('createManual', () => {
    it('creates a completed entry with source=manual and records an audit log entry', async () => {
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ auditLogService });

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
      const service = makeService();

      await expect(
        service.createManual('org-1', 'user-1', 'project-1', {
          startedAt: '2026-01-01T10:00:00.000Z',
          endedAt: '2026-01-01T09:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an end time in the future', async () => {
      const service = makeService();

      await expect(
        service.createManual('org-1', 'user-1', 'project-1', {
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a plain member with no ProjectMembership on this project', async () => {
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ projectMembershipsRepo });

      await expect(
        service.createManual('org-1', 'user-1', 'project-1', {
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: '2026-01-01T10:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update', () => {
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

    it("lets an admin edit someone else's entry and records an audit diff", async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
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
        findOne: jest
          .fn()
          .mockResolvedValue({ ...completedEntry, membershipId: 'm-admin' }),
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

    it("lets a manager edit someone else's entry", async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
      });
      const service = makeService({
        timeEntriesRepo,
        membershipsRepo: makeManagerMembershipsRepo(),
      });

      await expect(
        service.update('org-1', 'manager-1', 'entry-done', {
          endedAt: '2026-01-01T11:00:00.000Z',
        }),
      ).resolves.toMatchObject({
        endedAt: new Date('2026-01-01T11:00:00.000Z'),
      });
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

    it('is a no-op (no audit entry) when nothing actually changes', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
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

    it('rejects editing a still-running entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...runningEntry, membershipId: 'm-admin' }),
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
        findOne: jest
          .fn()
          .mockResolvedValue({ ...completedEntry, taskId: 'task-1' }),
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
        findOne: jest.fn().mockResolvedValue({ ...completedEntry }),
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
    it('opens a pause span for the running entry and records an audit log entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const save = jest.fn().mockResolvedValue(undefined);
      const timeEntryPausesRepo = makeTimeEntryPausesRepo({
        save,
        // Simulates the row `save` just persisted, so the subsequent
        // toSummary() read (a separate `find` call) sees it as open.
        find: jest.fn().mockResolvedValue([
          {
            id: 'pause-1',
            timeEntryId: 'entry-running',
            pausedAt: new Date('2026-01-01T09:20:00Z'),
            resumedAt: null,
          } as TimeEntryPause,
        ]),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        timeEntryPausesRepo,
        auditLogService,
      });

      const result = await service.pause('org-1', 'user-1');

      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          timeEntryId: 'entry-running',
          resumedAt: null,
        }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.paused' }),
      );
      expect(result.pausedAt).toBeInstanceOf(Date);
    });

    it('rejects with 404 when no timer is running', async () => {
      const service = makeService();

      await expect(service.pause('org-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects with 409 when already paused', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const timeEntryPausesRepo = makeTimeEntryPausesRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'pause-open',
          timeEntryId: 'entry-running',
          pausedAt: new Date('2026-01-01T09:10:00Z'),
          resumedAt: null,
        }),
      });
      const service = makeService({ timeEntriesRepo, timeEntryPausesRepo });

      await expect(service.pause('org-1', 'user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('resume', () => {
    it('closes the open pause span and records an audit log entry', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const openPause = {
        id: 'pause-open',
        timeEntryId: 'entry-running',
        pausedAt: new Date('2026-01-01T09:10:00Z'),
        resumedAt: null,
      } as TimeEntryPause;
      const save = jest.fn((input: Partial<TimeEntryPause>) =>
        Promise.resolve(input as TimeEntryPause),
      );
      const timeEntryPausesRepo = makeTimeEntryPausesRepo({
        findOne: jest.fn().mockResolvedValue(openPause),
        save,
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        timeEntriesRepo,
        timeEntryPausesRepo,
        auditLogService,
      });

      await service.resume('org-1', 'user-1');

      const savedPause = save.mock.calls[0][0] as TimeEntryPause;
      expect(savedPause.resumedAt).toBeInstanceOf(Date);
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.resumed' }),
      );
    });

    it('rejects with 404 when no timer is running', async () => {
      const service = makeService();

      await expect(service.resume('org-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects with 409 when not currently paused', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue({ ...runningEntry }),
      });
      const service = makeService({ timeEntriesRepo });

      await expect(service.resume('org-1', 'user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('current', () => {
    it('returns null and the server clock when nothing is running', async () => {
      const service = makeService();

      const result = await service.current('org-1', 'user-1');

      expect(result.entry).toBeNull();
      expect(result.now).toBeInstanceOf(Date);
    });

    it('returns the running entry when one exists', async () => {
      const timeEntriesRepo = makeTimeEntriesRepo({
        findOne: jest.fn().mockResolvedValue(runningEntry),
      });
      const service = makeService({ timeEntriesRepo });

      const result = await service.current('org-1', 'user-1');

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
      // The service calls memberships.findOne twice here — once to resolve
      // the caller (by userId), once to confirm the target exists (by id)
      // — so the mock needs to answer each differently, not return one
      // fixed value for both.
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn(
          (query: { where: { userId?: string; id?: string } }) =>
            query.where.userId
              ? Promise.resolve({ id: 'm-admin', role: MembershipRole.ADMIN })
              : Promise.resolve({ id: 'm-other', role: MembershipRole.MEMBER }),
        ),
      });
      const service = makeService({ timeEntriesRepo, membershipsRepo });

      const result = await service.list('org-1', 'admin-1', 'm-other');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { membershipId: 'm-other' } }),
      );
      expect(result[0].canEdit).toBe(true);
    });

    it("rejects a plain member trying to view another member's timesheet", async () => {
      const service = makeService();

      await expect(
        service.list('org-1', 'user-1', 'm-other'),
      ).rejects.toBeInstanceOf(ForbiddenException);
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
      jest.useFakeTimers().setSystemTime(new Date(2026, 0, 6, 10, 0, 0));
      const original = makeRunningEntry({
        id: 'entry-orig',
        startedAt: new Date(2026, 0, 5, 9, 0, 0),
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
      expect(oldEntry.endedAt).toEqual(new Date(2026, 0, 6, 0, 0, 0));

      const newEntries = [...fake.entries.values()].filter(
        (e) => e.id !== 'entry-orig',
      );
      expect(newEntries).toHaveLength(1);
      expect(newEntries[0]).toMatchObject({
        startedAt: new Date(2026, 0, 6, 0, 0, 0),
        endedAt: null,
        projectId: 'project-1',
        taskId: 'task-1',
        membershipId: 'm-1',
      });
    });

    it('catches a multi-day-old entry fully up in one call', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 0, 8, 12, 0, 0));
      const original = makeRunningEntry({
        id: 'entry-orig',
        startedAt: new Date(2026, 0, 5, 9, 0, 0),
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
      expect(stillOpen?.startedAt).toEqual(new Date(2026, 0, 8, 0, 0, 0));
    });

    it('carries an open pause across the split instead of silently resuming it', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 0, 6, 10, 0, 0));
      const original = makeRunningEntry({
        id: 'entry-orig',
        startedAt: new Date(2026, 0, 5, 9, 0, 0),
      });
      const openPause = {
        id: 'pause-1',
        organisationId: 'org-1',
        timeEntryId: 'entry-orig',
        pausedAt: new Date(2026, 0, 5, 20, 0, 0),
        resumedAt: null,
      } as TimeEntryPause;
      const fake = makeFakeDataSource([original], [openPause]);
      const timeEntriesRepo = makeTimeEntriesRepo({
        find: jest.fn().mockResolvedValue([original]),
      });
      const service = makeService({
        timeEntriesRepo,
        dataSource: fake.dataSource,
      });

      await service.splitRunningEntriesAcrossDayBoundary();

      const boundary = new Date(2026, 0, 6, 0, 0, 0);
      const oldPause = fake.pauses.get('pause-1')!;
      expect(oldPause.resumedAt).toEqual(boundary);

      const newEntry = [...fake.entries.values()].find(
        (e) => e.id !== 'entry-orig',
      )!;
      const newPause = [...fake.pauses.values()].find(
        (p) => p.timeEntryId === newEntry.id,
      );
      expect(newPause).toMatchObject({ pausedAt: boundary, resumedAt: null });
    });

    it('still splits into a positive-duration entry when startedAt is already exactly a previous midnight', async () => {
      // The steady-state shape this job's own output takes the night after
      // it first runs.
      jest.useFakeTimers().setSystemTime(new Date(2026, 0, 7, 8, 0, 0));
      const original = makeRunningEntry({
        id: 'entry-orig',
        startedAt: new Date(2026, 0, 6, 0, 0, 0),
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
      expect(oldEntry.endedAt).toEqual(new Date(2026, 0, 7, 0, 0, 0));
      expect(oldEntry.endedAt!.getTime()).toBeGreaterThan(
        oldEntry.startedAt.getTime(),
      );
    });

    it('leaves an entry that started today untouched', async () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 0, 6, 15, 0, 0));
      const original = makeRunningEntry({
        id: 'entry-today',
        startedAt: new Date(2026, 0, 6, 9, 0, 0),
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
