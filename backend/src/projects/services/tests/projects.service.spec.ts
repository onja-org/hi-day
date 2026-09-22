import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { Project } from '../../../database/entities/project.entity';
import { ProjectColour } from '../../../database/entities/project-colour.enum';
import { ProjectMembership } from '../../../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../../../database/entities/project-membership-role.enum';
import { ProjectTeam } from '../../../database/entities/project-team.entity';
import { Task } from '../../../database/entities/task.entity';
import { Team } from '../../../database/entities/team.entity';
import { TeamMembership } from '../../../database/entities/team-membership.entity';
import type { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import { ProjectsService } from '../projects.service';

function uniqueViolationError(): QueryFailedError {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate'));
  (error as unknown as { driverError: { code: string } }).driverError = {
    code: '23505',
  };
  return error;
}

describe('ProjectsService', () => {
  function makeProjectsRepo(overrides: Partial<Repository<Project>> = {}) {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((input: Partial<Project>) => input as Project),
      save: jest.fn((input: Partial<Project>) =>
        Promise.resolve(input as Project),
      ),
      createQueryBuilder: jest.fn(() => queryBuilder),
      ...overrides,
      __queryBuilder: queryBuilder,
    } as unknown as Repository<Project> & {
      __queryBuilder: typeof queryBuilder;
    };
  }

  function makeTasksRepo(overrides: Partial<Repository<Task>> = {}) {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    return {
      createQueryBuilder: jest.fn(() => queryBuilder),
      ...overrides,
      __queryBuilder: queryBuilder,
    } as unknown as Repository<Task> & { __queryBuilder: typeof queryBuilder };
  }

  function makeProjectMembershipsRepo(
    overrides: Partial<Repository<ProjectMembership>> = {},
  ) {
    return {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(
        (input: Partial<ProjectMembership>) => input as ProjectMembership,
      ),
      save: jest.fn((input: Partial<ProjectMembership>) =>
        Promise.resolve(input as ProjectMembership),
      ),
      remove: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as Repository<ProjectMembership>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeProjectTeamsRepo(
    overrides: Partial<Repository<ProjectTeam>> = {},
  ) {
    return {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((input: Partial<ProjectTeam>) => input as ProjectTeam),
      save: jest.fn((input: Partial<ProjectTeam>) =>
        Promise.resolve(input as ProjectTeam),
      ),
      remove: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as Repository<ProjectTeam>;
  }

  function makeTeamsRepo(overrides: Partial<Repository<Team>> = {}) {
    return {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      ...overrides,
    } as unknown as Repository<Team>;
  }

  function makeTeamMembershipsRepo(
    overrides: Partial<Repository<TeamMembership>> = {},
  ) {
    return {
      find: jest.fn().mockResolvedValue([]),
      ...overrides,
    } as unknown as Repository<TeamMembership>;
  }

  function makeDataSource() {
    const save = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockResolvedValue(undefined);
    const getRepository = jest.fn(() => ({ insert }));
    const manager = { save, getRepository } as unknown as EntityManager;
    const transaction = jest.fn(
      (fn: (manager: EntityManager) => Promise<unknown>) => fn(manager),
    );
    return {
      dataSource: { transaction } as unknown,
      transaction,
      save,
      insert,
      getRepository,
    };
  }

  function makeAuditLogService() {
    const record = jest.fn().mockResolvedValue(undefined);
    return {
      auditLogService: { record } as unknown as AuditLogService,
      record,
    };
  }

  function makeTimeEntriesService(overrides: Partial<TimeEntriesService> = {}) {
    const hasRunningEntryForProject = jest.fn().mockResolvedValue(false);
    return {
      timeEntriesService: {
        hasRunningEntryForProject,
        ...overrides,
      } as unknown as TimeEntriesService,
      hasRunningEntryForProject,
    };
  }

  function makeService(
    overrides: {
      projectsRepo?: Repository<Project>;
      tasksRepo?: Repository<Task>;
      projectMembershipsRepo?: Repository<ProjectMembership>;
      projectTeamsRepo?: Repository<ProjectTeam>;
      teamsRepo?: Repository<Team>;
      teamMembershipsRepo?: Repository<TeamMembership>;
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
      timeEntriesService?: TimeEntriesService;
    } = {},
  ) {
    return new ProjectsService(
      overrides.projectsRepo ?? makeProjectsRepo(),
      overrides.tasksRepo ?? makeTasksRepo(),
      overrides.projectMembershipsRepo ?? makeProjectMembershipsRepo(),
      overrides.projectTeamsRepo ?? makeProjectTeamsRepo(),
      overrides.teamsRepo ?? makeTeamsRepo(),
      overrides.teamMembershipsRepo ?? makeTeamMembershipsRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
      overrides.timeEntriesService ??
        makeTimeEntriesService().timeEntriesService,
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
  };

  describe('create', () => {
    it('creates a project and records an audit log entry', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        dataSource,
        auditLogService,
      });

      const result = await service.create('org-1', 'admin-1', {
        name: 'Website',
      });

      expect(result.name).toBe('Website');
      expect(result.status).toBe('active');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'project.created' }),
      );
    });

    it('rejects a duplicate name in the same organisation (pre-check)', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue(baseProject),
      });
      const service = makeService({ projectsRepo });

      await expect(
        service.create('org-1', 'admin-1', { name: 'Website' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a duplicate name lost to a race, via the DB unique constraint', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockRejectedValue(uniqueViolationError()),
      });
      const service = makeService({ projectsRepo });

      await expect(
        service.create('org-1', 'admin-1', { name: 'Website' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('adds members and teams within the same transaction', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const membershipsRepo = makeMembershipsRepo({
        count: jest.fn().mockResolvedValue(2),
      });
      const teamsRepo = makeTeamsRepo({
        count: jest.fn().mockResolvedValue(1),
      });
      const { dataSource, getRepository, insert } = makeDataSource();
      const { auditLogService } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        membershipsRepo,
        teamsRepo,
        dataSource,
        auditLogService,
      });

      await service.create('org-1', 'admin-1', {
        name: 'Website',
        members: [
          { membershipId: 'membership-1' },
          { membershipId: 'membership-2', role: ProjectMembershipRole.MANAGER },
        ],
        teamIds: ['team-1'],
      });

      expect(getRepository).toHaveBeenCalled();
      expect(insert).toHaveBeenCalledWith([
        expect.objectContaining({
          membershipId: 'membership-1',
          role: ProjectMembershipRole.MEMBER,
        }),
        expect.objectContaining({
          membershipId: 'membership-2',
          role: ProjectMembershipRole.MANAGER,
        }),
      ]);
      expect(insert).toHaveBeenCalledWith([
        expect.objectContaining({ teamId: 'team-1' }),
      ]);
    });

    it('rejects a member that does not belong to this organisation', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const membershipsRepo = makeMembershipsRepo({
        count: jest.fn().mockResolvedValue(0),
      });
      const service = makeService({ projectsRepo, membershipsRepo });

      await expect(
        service.create('org-1', 'admin-1', {
          name: 'Website',
          members: [{ membershipId: 'membership-1' }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a team that does not belong to this organisation', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const teamsRepo = makeTeamsRepo({
        count: jest.fn().mockResolvedValue(0),
      });
      const service = makeService({ projectsRepo, teamsRepo });

      await expect(
        service.create('org-1', 'admin-1', {
          name: 'Website',
          teamIds: ['team-1'],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws when the project does not belong to the organisation', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ projectsRepo });

      await expect(
        service.update('org-1', 'project-1', 'admin-1', { name: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects edits to an archived project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseProject, archivedAt: new Date() }),
      });
      const service = makeService({ projectsRepo });

      await expect(
        service.update('org-1', 'project-1', 'admin-1', { name: 'New' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('updates fields and records an audit log entry', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        dataSource,
        auditLogService,
      });

      const result = await service.update('org-1', 'project-1', 'admin-1', {
        description: 'A new description',
      });

      expect(result.description).toBe('A new description');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'project.updated' }),
      );
    });
  });

  describe('archive / unarchive', () => {
    it('archives an active project and records an audit log entry', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        dataSource,
        auditLogService,
      });

      const result = await service.archive('org-1', 'project-1', 'admin-1');

      expect(result.status).toBe('archived');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'project.archived' }),
      );
    });

    it('is a no-op when the project is already archived', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseProject, archivedAt: new Date() }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ projectsRepo, auditLogService });

      await service.archive('org-1', 'project-1', 'admin-1');

      expect(record).not.toHaveBeenCalled();
    });

    it('rejects archiving while a timer is running against the project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const { timeEntriesService } = makeTimeEntriesService({
        hasRunningEntryForProject: jest.fn().mockResolvedValue(true),
      });
      const service = makeService({ projectsRepo, timeEntriesService });

      await expect(
        service.archive('org-1', 'project-1', 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('unarchives a project and records an audit log entry', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseProject, archivedAt: new Date() }),
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        dataSource,
        auditLogService,
      });

      const result = await service.unarchive('org-1', 'project-1', 'admin-1');

      expect(result.status).toBe('active');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'project.unarchived' }),
      );
    });
  });

  describe('addMember', () => {
    const membership = {
      id: 'membership-1',
      userId: 'user-1',
      organisationId: 'org-1',
      status: MembershipStatus.ACTIVE,
      user: { email: 'a@b.test', name: 'A B' },
    };

    it('assigns a member and records an audit log entry', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        projectMembershipsRepo,
        membershipsRepo,
        dataSource,
        auditLogService,
      });

      const result = await service.addMember('org-1', 'project-1', 'admin-1', {
        membershipId: 'membership-1',
      });

      expect(result.email).toBe('a@b.test');
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'project.member_added' }),
      );
    });

    it('rejects assigning a member to an archived project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseProject, archivedAt: new Date() }),
      });
      const service = makeService({ projectsRepo });

      await expect(
        service.addMember('org-1', 'project-1', 'admin-1', {
          membershipId: 'membership-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a membership that does not belong to this organisation', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ projectsRepo, membershipsRepo });

      await expect(
        service.addMember('org-1', 'project-1', 'admin-1', {
          membershipId: 'membership-from-another-org',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a member who is already assigned to the project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'pm-1' }),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
      });
      const service = makeService({
        projectsRepo,
        projectMembershipsRepo,
        membershipsRepo,
      });

      await expect(
        service.addMember('org-1', 'project-1', 'admin-1', {
          membershipId: 'membership-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('defaults to a MEMBER role when none is specified', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
      });
      const service = makeService({
        projectsRepo,
        projectMembershipsRepo,
        membershipsRepo,
      });

      const result = await service.addMember('org-1', 'project-1', 'admin-1', {
        membershipId: 'membership-1',
      });

      expect(result.role).toBe(ProjectMembershipRole.MEMBER);
    });

    it('assigns a MANAGER role when specified', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
      });
      const service = makeService({
        projectsRepo,
        projectMembershipsRepo,
        membershipsRepo,
      });

      const result = await service.addMember('org-1', 'project-1', 'admin-1', {
        membershipId: 'membership-1',
        role: ProjectMembershipRole.MANAGER,
      });

      expect(result.role).toBe(ProjectMembershipRole.MANAGER);
    });
  });

  describe('updateMember', () => {
    const existingProjectMembership = {
      id: 'pm-1',
      projectId: 'project-1',
      membershipId: 'membership-1',
      role: ProjectMembershipRole.MEMBER,
      membership: {
        userId: 'user-1',
        user: { email: 'a@b.test', name: 'A B' },
      },
    };

    it('promotes a member to project manager', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({ ...existingProjectMembership }),
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        projectMembershipsRepo,
        dataSource,
        auditLogService,
      });

      const result = await service.updateMember(
        'org-1',
        'project-1',
        'membership-1',
        'admin-1',
        { role: ProjectMembershipRole.MANAGER },
      );

      expect(result.role).toBe(ProjectMembershipRole.MANAGER);
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'project.member_updated' }),
      );
    });

    it('throws when the member is not assigned to the project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ projectsRepo, projectMembershipsRepo });

      await expect(
        service.updateMember('org-1', 'project-1', 'membership-1', 'admin-1', {
          role: ProjectMembershipRole.MANAGER,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects updating a member on an archived project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseProject, archivedAt: new Date() }),
      });
      const service = makeService({ projectsRepo });

      await expect(
        service.updateMember('org-1', 'project-1', 'membership-1', 'admin-1', {
          role: ProjectMembershipRole.MANAGER,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('removeMember', () => {
    it('removes an assigned member and records an audit log entry', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'pm-1' }),
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        projectMembershipsRepo,
        dataSource,
        auditLogService,
      });

      await service.removeMember(
        'org-1',
        'project-1',
        'membership-1',
        'admin-1',
      );

      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'project.member_removed' }),
      );
    });

    it('throws when the member is not assigned to the project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ projectsRepo, projectMembershipsRepo });

      await expect(
        service.removeMember('org-1', 'project-1', 'membership-1', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects removing a member from an archived project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseProject, archivedAt: new Date() }),
      });
      const service = makeService({ projectsRepo });

      await expect(
        service.removeMember('org-1', 'project-1', 'membership-1', 'admin-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('list', () => {
    it('scopes the query to the organisation and applies the status filter for an admin', async () => {
      const projectsRepo = makeProjectsRepo();
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'admin-membership',
          role: MembershipRole.ADMIN,
        }),
      });
      const service = makeService({ projectsRepo, membershipsRepo });

      await service.list('org-1', 'admin-1', { status: 'active' });

      const queryBuilder = (
        projectsRepo as unknown as { __queryBuilder: Record<string, jest.Mock> }
      ).__queryBuilder;
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'project.organisationId = :organisationId',
        { organisationId: 'org-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'project.archivedAt IS NULL',
      );
      expect(queryBuilder.innerJoin).not.toHaveBeenCalled();
    });

    it("scopes the query to the caller's own projects for a manager", async () => {
      const projectsRepo = makeProjectsRepo();
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'manager-membership',
          role: MembershipRole.MANAGER,
        }),
      });
      const service = makeService({ projectsRepo, membershipsRepo });

      await service.list('org-1', 'manager-1', {});

      const queryBuilder = (
        projectsRepo as unknown as { __queryBuilder: Record<string, jest.Mock> }
      ).__queryBuilder;
      expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
        'project.memberships',
        'callerMembership',
        'callerMembership.membershipId = :callerMembershipId',
        { callerMembershipId: 'manager-membership' },
      );
      expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
        'project.projectTeams',
        'callerProjectTeam',
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(callerMembership.id IS NOT NULL OR callerTeamMembership.id IS NOT NULL)',
      );
      expect(queryBuilder.distinct).toHaveBeenCalledWith(true);
    });

    it('throws when the caller has no active membership in the organisation', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.list('org-1', 'caller-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('attaches a task count per project from a single grouped query', async () => {
      const projectsRepo = makeProjectsRepo();
      (
        projectsRepo as unknown as { __queryBuilder: { getMany: jest.Mock } }
      ).__queryBuilder.getMany.mockResolvedValue([
        { ...baseProject, id: 'project-1' },
        { ...baseProject, id: 'project-2' },
      ]);
      const getRawMany = jest
        .fn()
        .mockResolvedValue([{ projectId: 'project-1', count: '3' }]);
      const tasksRepo = makeTasksRepo();
      (
        tasksRepo as unknown as { __queryBuilder: { getRawMany: jest.Mock } }
      ).__queryBuilder.getRawMany = getRawMany;
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'admin-membership',
          role: MembershipRole.ADMIN,
        }),
      });
      const service = makeService({ projectsRepo, tasksRepo, membershipsRepo });

      const result = await service.list('org-1', 'admin-1', {});

      expect(result).toEqual([
        expect.objectContaining({ id: 'project-1', taskCount: 3 }),
        expect.objectContaining({ id: 'project-2', taskCount: 0 }),
      ]);
    });

    it('skips the task count query when there are no projects', async () => {
      const tasksRepo = makeTasksRepo();
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({
          id: 'admin-membership',
          role: MembershipRole.ADMIN,
        }),
      });
      const service = makeService({ tasksRepo, membershipsRepo });

      await service.list('org-1', 'admin-1', {});

      const createQueryBuilder = (
        tasksRepo as unknown as { createQueryBuilder: jest.Mock }
      ).createQueryBuilder;
      expect(createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('listForTimeTracking', () => {
    it('returns every active project for an org admin, regardless of ProjectMembership', async () => {
      const projectsFind = jest.fn().mockResolvedValue([{ ...baseProject }]);
      const projectsRepo = makeProjectsRepo({ find: projectsFind });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-admin', role: MembershipRole.ADMIN }),
      });
      const projectMembershipsFind = jest.fn().mockResolvedValue([]);
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        find: projectMembershipsFind,
      });
      const service = makeService({
        projectsRepo,
        membershipsRepo,
        projectMembershipsRepo,
      });

      const result = await service.listForTimeTracking('org-1', 'admin-1');

      expect(result).toHaveLength(1);
      expect(projectsFind).toHaveBeenCalledTimes(1);
      expect(projectMembershipsFind).not.toHaveBeenCalled();
    });

    it('returns only projects the caller holds a ProjectMembership on, for a plain member', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        find: jest.fn().mockResolvedValue([{ project: { ...baseProject } }]),
      });
      const service = makeService({ membershipsRepo, projectMembershipsRepo });

      const result = await service.listForTimeTracking('org-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('project-1');
    });

    it('rejects a caller with no active membership in the organisation', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.listForTimeTracking('org-1', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('includes projects reached only via a Team assigned to them, for a plain member', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'm-1', role: MembershipRole.MEMBER }),
      });
      const projectMembershipsRepo = makeProjectMembershipsRepo({
        find: jest.fn().mockResolvedValue([]),
      });
      const teamMembershipsRepo = makeTeamMembershipsRepo({
        find: jest.fn().mockResolvedValue([{ teamId: 'team-1' }]),
      });
      const projectTeamsFind = jest
        .fn()
        .mockResolvedValue([{ project: { ...baseProject, id: 'project-2' } }]);
      const projectTeamsRepo = makeProjectTeamsRepo({ find: projectTeamsFind });
      const service = makeService({
        membershipsRepo,
        projectMembershipsRepo,
        teamMembershipsRepo,
        projectTeamsRepo,
      });

      const result = await service.listForTimeTracking('org-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('project-2');
      expect(projectTeamsFind).toHaveBeenCalledTimes(1);
    });
  });

  describe('listAssignableMembers', () => {
    it('returns a minimal summary, without role/team/status', async () => {
      const find = jest.fn().mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          user: { email: 'a@b.test', name: 'A B' },
        },
      ]);
      const membershipsRepo = makeMembershipsRepo({ find });
      const service = makeService({ membershipsRepo });

      const result = await service.listAssignableMembers('org-1');

      expect(result).toEqual([
        {
          id: 'membership-1',
          userId: 'user-1',
          email: 'a@b.test',
          name: 'A B',
        },
      ]);
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: 'org-1', status: MembershipStatus.ACTIVE },
        }),
      );
    });
  });

  describe('listAssignableTeams', () => {
    it('returns every team in the organisation', async () => {
      const find = jest
        .fn()
        .mockResolvedValue([{ id: 'team-1', name: 'Engineering' }]);
      const teamsRepo = makeTeamsRepo({ find });
      const service = makeService({ teamsRepo });

      const result = await service.listAssignableTeams('org-1');

      expect(result).toEqual([{ id: 'team-1', name: 'Engineering' }]);
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organisationId: 'org-1' } }),
      );
    });
  });

  describe('addTeam', () => {
    it('assigns a team and records an audit log entry', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Eng' }),
      });
      const projectTeamsRepo = makeProjectTeamsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        teamsRepo,
        projectTeamsRepo,
        dataSource,
        auditLogService,
      });

      const result = await service.addTeam('org-1', 'project-1', 'admin-1', {
        teamId: 'team-1',
      });

      expect(result).toEqual(
        expect.objectContaining({ teamId: 'team-1', name: 'Eng' }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'project.team_added' }),
      );
    });

    it('rejects a team from another organisation', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ projectsRepo, teamsRepo });

      await expect(
        service.addTeam('org-1', 'project-1', 'admin-1', { teamId: 'team-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a team already on the project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const teamsRepo = makeTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'team-1', name: 'Eng' }),
      });
      const projectTeamsRepo = makeProjectTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'pt-1' }),
      });
      const service = makeService({
        projectsRepo,
        teamsRepo,
        projectTeamsRepo,
      });

      await expect(
        service.addTeam('org-1', 'project-1', 'admin-1', { teamId: 'team-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects assigning a team to an archived project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest
          .fn()
          .mockResolvedValue({ ...baseProject, archivedAt: new Date() }),
      });
      const service = makeService({ projectsRepo });

      await expect(
        service.addTeam('org-1', 'project-1', 'admin-1', { teamId: 'team-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('removeTeam', () => {
    it('removes the team and records an audit log entry', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const remove = jest.fn().mockResolvedValue(undefined);
      const projectTeamsRepo = makeProjectTeamsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'pt-1', teamId: 'team-1' }),
        remove,
      });
      const { dataSource } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        projectsRepo,
        projectTeamsRepo,
        dataSource,
        auditLogService,
      });

      await service.removeTeam('org-1', 'project-1', 'team-1', 'admin-1');

      expect(remove).toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'project.team_removed' }),
      );
    });

    it('throws when the team is not on the project', async () => {
      const projectsRepo = makeProjectsRepo({
        findOne: jest.fn().mockResolvedValue({ ...baseProject }),
      });
      const projectTeamsRepo = makeProjectTeamsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ projectsRepo, projectTeamsRepo });

      await expect(
        service.removeTeam('org-1', 'project-1', 'team-1', 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
