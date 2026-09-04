import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { Project } from '../../../database/entities/project.entity';
import { ProjectMembership } from '../../../database/entities/project-membership.entity';
import { Task } from '../../../database/entities/task.entity';
import { TimeEntry } from '../../../database/entities/time-entry.entity';
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
    const manager = {
      save: jest.fn((input: Partial<TimeEntry>) =>
        Promise.resolve({ id: 'entry-2', ...input } as TimeEntry),
      ),
      create: jest.fn((_entity: unknown, input: Partial<TimeEntry>) => input),
      findOne: jest.fn().mockResolvedValue(null),
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
      membershipsRepo?: Repository<Membership>;
      projectMembershipsRepo?: Repository<ProjectMembership>;
      projectsRepo?: Repository<Project>;
      tasksRepo?: Repository<Task>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new TimeEntriesService(
      overrides.timeEntriesRepo ?? makeTimeEntriesRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      overrides.projectMembershipsRepo ?? makeProjectMembershipsRepo(),
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
});
