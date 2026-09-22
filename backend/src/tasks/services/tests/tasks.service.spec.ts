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
import { ProjectColour } from '../../../database/entities/project-colour.enum';
import { ProjectMembership } from '../../../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../../../database/entities/project-membership-role.enum';
import { Task } from '../../../database/entities/task.entity';
import { TasksService } from '../tasks.service';

describe('TasksService', () => {
  function makeTasksRepo(overrides: Partial<Repository<Task>> = {}) {
    return {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((input: Partial<Task>) => input as Task),
      save: jest.fn((input: Partial<Task>) => Promise.resolve(input as Task)),
      ...overrides,
    } as unknown as Repository<Task>;
  }

  function makeProjectsRepo(overrides: Partial<Repository<Project>> = {}) {
    return {
      findOne: jest.fn().mockResolvedValue(baseProject),
      ...overrides,
    } as unknown as Repository<Project>;
  }

  function makeProjectMembershipsRepo(
    overrides: Partial<Repository<ProjectMembership>> = {},
  ) {
    return {
      findOne: jest.fn(),
      ...overrides,
    } as unknown as Repository<ProjectMembership>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeDataSource() {
    const save = jest.fn().mockResolvedValue(undefined);
    const manager = { save } as unknown as EntityManager;
    const transaction = jest.fn(
      (fn: (manager: EntityManager) => Promise<unknown>) => fn(manager),
    );
    return { dataSource: { transaction } as unknown, transaction, save };
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
      tasksRepo?: Repository<Task>;
      projectsRepo?: Repository<Project>;
      projectMembershipsRepo?: Repository<ProjectMembership>;
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new TasksService(
      overrides.tasksRepo ?? makeTasksRepo(),
      overrides.projectsRepo ?? makeProjectsRepo(),
      overrides.projectMembershipsRepo ?? makeProjectMembershipsRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  const baseProject = {
    id: 'project-1',
    name: 'Website',
    description: null,
    colour: ProjectColour.BLUE,
    archivedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    organisationId: 'org-1',
  } as Project;

  const archivedProject = {
    ...baseProject,
    archivedAt: new Date('2026-02-01'),
  } as Project;

  const baseAssignee = {
    id: 'pm-1',
    role: ProjectMembershipRole.MEMBER,
    membershipId: 'm-1',
    membership: {
      id: 'm-1',
      userId: 'user-1',
      user: { email: 'a@b.test', name: 'A B' },
    },
  } as unknown as ProjectMembership;

  const baseTask = {
    id: 'task-1',
    projectId: 'project-1',
    name: 'Write copy',
    description: null,
    estimate: null,
    dueDate: null,
    closedAt: null,
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
    assigneeProjectMembershipId: null,
    assignee: null,
  } as unknown as Task;

  describe('create', () => {
    it('creates a task and records an audit log entry', async () => {
      const tasksRepo = makeTasksRepo();
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ tasksRepo, dataSource, auditLogService });

      const result = await service.create('org-1', 'project-1', 'admin-1', {
        name: 'Write copy',
      });

      expect(result.name).toBe('Write copy');
      expect(result.status).toBe('open');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'task.created' }),
      );
    });

    it('rejects when the project is archived', async () => {
      const service = makeService({
        projectsRepo: makeProjectsRepo({
          findOne: jest.fn().mockResolvedValue(archivedProject),
        }),
      });

      await expect(
        service.create('org-1', 'project-1', 'admin-1', { name: 'Task' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an assignee who is not a project member', async () => {
      const service = makeService({
        projectMembershipsRepo: makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.create('org-1', 'project-1', 'admin-1', {
          name: 'Task',
          assigneeProjectMembershipId: 'pm-nope',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('assigns the task when the assignee is a project member', async () => {
      const service = makeService({
        projectMembershipsRepo: makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue(baseAssignee),
        }),
      });

      const result = await service.create('org-1', 'project-1', 'admin-1', {
        name: 'Task',
        assigneeProjectMembershipId: 'pm-1',
      });

      expect(result.assignee).toEqual({
        membershipId: 'pm-1',
        userId: 'user-1',
        email: 'a@b.test',
        name: 'A B',
      });
    });
  });

  describe('update', () => {
    it('updates fields and records an audit log entry', async () => {
      const tasksRepo = makeTasksRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseTask }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ tasksRepo, auditLogService });

      const result = await service.update(
        'org-1',
        'project-1',
        'task-1',
        'admin-1',
        {
          name: 'Renamed',
        },
      );

      expect(result.name).toBe('Renamed');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'task.updated' }),
      );
    });

    it('rejects when the task is not on this project', async () => {
      const service = makeService({
        tasksRepo: makeTasksRepo({
          findOne: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.update('org-1', 'project-1', 'task-1', 'admin-1', {
          name: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('clears the assignee when explicitly set to null', async () => {
      const tasksRepo = makeTasksRepo({
        findOne: jest.fn().mockResolvedValue({
          ...baseTask,
          assigneeProjectMembershipId: 'pm-1',
        }),
      });
      const service = makeService({ tasksRepo });

      const result = await service.update(
        'org-1',
        'project-1',
        'task-1',
        'admin-1',
        {
          assigneeProjectMembershipId: null,
        },
      );

      expect(result.assignee).toBeNull();
    });

    it('rejects when the project is archived', async () => {
      const service = makeService({
        projectsRepo: makeProjectsRepo({
          findOne: jest.fn().mockResolvedValue(archivedProject),
        }),
      });

      await expect(
        service.update('org-1', 'project-1', 'task-1', 'admin-1', {
          name: 'x',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('close / reopen', () => {
    it('allows an org admin to close any task', async () => {
      const tasksRepo = makeTasksRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseTask }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        tasksRepo,
        auditLogService,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
        }),
      });

      const result = await service.close(
        'org-1',
        'project-1',
        'task-1',
        'admin-1',
      );

      expect(result.status).toBe('closed');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'task.closed' }),
      );
    });

    it('allows the assignee to close their own task', async () => {
      const tasksRepo = makeTasksRepo({
        findOne: jest.fn().mockResolvedValue({
          ...baseTask,
          assigneeProjectMembershipId: 'pm-1',
        }),
      });
      const service = makeService({
        tasksRepo,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
        }),
        projectMembershipsRepo: makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({
            id: 'pm-1',
            role: ProjectMembershipRole.MEMBER,
          }),
        }),
      });

      const result = await service.close(
        'org-1',
        'project-1',
        'task-1',
        'user-1',
      );

      expect(result.status).toBe('closed');
    });

    it('rejects a plain member closing a task assigned to someone else', async () => {
      const tasksRepo = makeTasksRepo({
        findOne: jest.fn().mockResolvedValue({
          ...baseTask,
          assigneeProjectMembershipId: 'pm-other',
        }),
      });
      const service = makeService({
        tasksRepo,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
        }),
        projectMembershipsRepo: makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({
            id: 'pm-1',
            role: ProjectMembershipRole.MEMBER,
          }),
        }),
      });

      await expect(
        service.close('org-1', 'project-1', 'task-1', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a project manager to reopen a task', async () => {
      const tasksRepo = makeTasksRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseTask, closedAt: new Date('2026-01-05') }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        tasksRepo,
        auditLogService,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
        }),
        projectMembershipsRepo: makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({
            id: 'pm-1',
            role: ProjectMembershipRole.MANAGER,
          }),
        }),
      });

      const result = await service.reopen(
        'org-1',
        'project-1',
        'task-1',
        'user-1',
      );

      expect(result.status).toBe('open');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'task.reopened' }),
      );
    });

    it('is idempotent when closing an already-closed task', async () => {
      const tasksRepo = makeTasksRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseTask, closedAt: new Date('2026-01-05') }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        tasksRepo,
        auditLogService,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
        }),
      });

      const result = await service.close(
        'org-1',
        'project-1',
        'task-1',
        'admin-1',
      );

      expect(result.status).toBe('closed');
      expect(record).not.toHaveBeenCalled();
    });

    it('rejects closing a task on an archived project', async () => {
      const service = makeService({
        projectsRepo: makeProjectsRepo({
          findOne: jest.fn().mockResolvedValue(archivedProject),
        }),
      });

      await expect(
        service.close('org-1', 'project-1', 'task-1', 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('list', () => {
    it('returns the project context, canManage, and the task list for an org admin', async () => {
      const tasksRepo = makeTasksRepo({
        find: jest.fn().mockResolvedValue([baseTask]),
      });
      const service = makeService({ tasksRepo });

      const result = await service.list('org-1', 'project-1', 'admin-1');

      expect(result.project).toEqual({
        id: 'project-1',
        name: 'Website',
        colour: ProjectColour.BLUE,
        status: 'active',
      });
      expect(result.tasks).toHaveLength(1);
      expect(result.canManage).toBe(true);
    });

    it('marks canManage false and assignedToMe true for a plain assigned member', async () => {
      const tasksRepo = makeTasksRepo({
        find: jest
          .fn()
          .mockResolvedValue([
            { ...baseTask, assigneeProjectMembershipId: 'pm-1' },
          ]),
      });
      const service = makeService({
        tasksRepo,
        membershipsRepo: makeMembershipsRepo({
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
        }),
        projectMembershipsRepo: makeProjectMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({
            id: 'pm-1',
            role: ProjectMembershipRole.MEMBER,
          }),
        }),
      });

      const result = await service.list('org-1', 'project-1', 'user-1');

      expect(result.canManage).toBe(false);
      expect(result.tasks[0].assignedToMe).toBe(true);
    });
  });
});
