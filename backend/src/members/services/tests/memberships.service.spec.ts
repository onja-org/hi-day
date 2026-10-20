import { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { DevicesService } from '../../../devices/services/devices.service';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { MembershipsService } from '../memberships.service';
import { AuthService } from '../../../auth/services/auth.service';
import { User } from '../../../database/entities/user.entity';

describe('MembershipsService', () => {
  function makeQueryBuilder(result: unknown[] = []) {
    const qb = {
      innerJoinAndSelect: jest.fn(),
      innerJoin: jest.fn(),
      leftJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      getMany: jest.fn().mockResolvedValue(result),
    };
    qb.innerJoinAndSelect.mockReturnValue(qb);
    qb.innerJoin.mockReturnValue(qb);
    qb.leftJoinAndSelect.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);
    qb.orderBy.mockReturnValue(qb);
    return qb;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> & {
      queryBuilder?: ReturnType<typeof makeQueryBuilder>;
    } = {},
  ) {
    const { queryBuilder, ...rest } = overrides;
    return {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(queryBuilder ?? makeQueryBuilder()),
      ...rest,
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

  function makeDevicesService() {
    const signOutAllForUser = jest.fn().mockResolvedValue(undefined);
    return {
      devicesService: { signOutAllForUser } as unknown as DevicesService,
      signOutAllForUser,
    };
  }

  function makeAuthService() {
    const forgotPassword = jest.fn().mockResolvedValue({ message: 'ok' });
    return {
      authService: { forgotPassword } as unknown as AuthService,
      forgotPassword,
    };
  }

  function makeService(
    overrides: {
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
      devicesService?: DevicesService;
      authService?: AuthService;
      timeEntriesService?: TimeEntriesService;
    } = {},
  ) {
    return new MembershipsService(
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
      overrides.devicesService ?? makeDevicesService().devicesService,
      overrides.authService ?? makeAuthService().authService,
      overrides.timeEntriesService ??
        ({
          stopEntriesDisallowedByApps: jest.fn().mockResolvedValue(0),
        } as unknown as TimeEntriesService),
    );
  }

  describe('listActiveForOrganisation', () => {
    it('throws when the caller has no active membership in the organisation', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.listActiveForOrganisation('org-1', 'caller-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lists every active membership, unfiltered, for an admin caller', async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      });
      const find = jest.fn().mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          role: MembershipRole.MEMBER,
          teamMemberships: [{ teamId: 'team-2', isManager: false }],
          projectMemberships: [
            { id: 'pm-1', projectId: 'project-1' },
            { id: 'pm-2', projectId: 'project-2' },
          ],
          status: MembershipStatus.ACTIVE,
          createdAt: new Date('2026-01-01'),
          user: { email: 'a@b.test', name: 'A B' },
        },
      ]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne, find }),
      });

      const summaries = await service.listActiveForOrganisation(
        'org-1',
        'caller-1',
      );

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: 'org-1', status: MembershipStatus.ACTIVE },
        }),
      );
      expect(summaries).toEqual([
        {
          id: 'membership-1',
          userId: 'user-1',
          email: 'a@b.test',
          name: 'A B',
          role: MembershipRole.MEMBER,
          teamIds: ['team-2'],
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date('2026-01-01'),
          projectIds: ['project-1', 'project-2'],
          expectedWorkDays: null,
          trackingDisabledDays: null,
          expectedWeeklyHours: null,
          weeklyLimitHours: null,
          dailyLimitHours: null,
          canDeleteScreenshots: null,
          screenshotFrequencySeconds: null,
          canDeleteScreenshots: null,
          projectsEnabled: null,
        },
      ]);
    });

    it('scopes the list to the teams the manager caller manages', async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
      });
      const queryBuilder = makeQueryBuilder([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne, queryBuilder }),
      });

      await service.listActiveForOrganisation('org-1', 'caller-1');

      expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
        'membership.teamMemberships',
        'scopeTm',
        'scopeTm.teamId IN (:...scopeTeamIds)',
        { scopeTeamIds: ['team-1'] },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'membership.status = :status',
        { status: MembershipStatus.ACTIVE },
      );
    });

    it('includes every team a returned member belongs to, not just the scoping team', async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
      });
      const queryBuilder = makeQueryBuilder([
        {
          id: 'membership-1',
          userId: 'user-1',
          role: MembershipRole.MEMBER,
          teamMemberships: [
            { teamId: 'team-1', isManager: false },
            { teamId: 'team-2', isManager: false },
          ],
          status: MembershipStatus.ACTIVE,
          createdAt: new Date('2026-01-01'),
          user: { email: 'a@b.test', name: 'A B' },
        },
      ]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne, queryBuilder }),
      });

      const summaries = await service.listActiveForOrganisation(
        'org-1',
        'caller-1',
      );

      expect(summaries[0].teamIds).toEqual(['team-1', 'team-2']);
    });

    it('returns no members for a manager who manages no team, without querying', async () => {
      const findOne = jest.fn().mockResolvedValue({
        role: MembershipRole.MANAGER,
        teamMemberships: [],
      });
      const find = jest.fn();
      const createQueryBuilder = jest.fn();
      const membershipsRepo = makeMembershipsRepo({
        findOne,
        find,
        createQueryBuilder,
      });
      const service = makeService({ membershipsRepo });

      const summaries = await service.listActiveForOrganisation(
        'org-1',
        'caller-1',
      );

      expect(summaries).toEqual([]);
      expect(createQueryBuilder).not.toHaveBeenCalled();
      expect(find).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("renames the member's User and saves it alongside the Membership", async () => {
      const caller = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B', firstName: 'A', lastName: 'B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const { dataSource, save } = makeDataSource();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        dataSource,
      });

      const result = await service.update('org-1', 'membership-1', 'admin-1', {
        firstName: 'Ada',
        lastName: 'Lovelace',
      });

      expect(save).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          firstName: 'Ada',
          lastName: 'Lovelace',
          name: 'Ada Lovelace',
        }),
      );
      expect(result.name).toBe('Ada Lovelace');
    });

    it('rejects a manager renaming an admin', async () => {
      const caller = {
        id: 'manager-membership',
        userId: 'manager-1',
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [{ teamId: 'team-1', isManager: false }],
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
      });

      await expect(
        service.update('org-1', 'membership-1', 'manager-1', {
          firstName: 'X',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when the membership does not belong to the organisation', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'membership-1', 'admin-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('changes the role without touching status when deactivate is not set', async () => {
      const caller = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const { dataSource, save } = makeDataSource();
      const service = makeService({ membershipsRepo, dataSource });

      const result = await service.update('org-1', 'membership-1', 'admin-1', {
        role: MembershipRole.MANAGER,
      });

      expect(result.role).toBe(MembershipRole.MANAGER);
      expect(result.status).toBe(MembershipStatus.ACTIVE);
      expect(save).toHaveBeenCalledWith(
        Membership,
        expect.objectContaining({ role: MembershipRole.MANAGER }),
      );
    });

    it('deactivates the membership and records an audit log entry', async () => {
      const caller = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const { dataSource, save } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const { devicesService, signOutAllForUser } = makeDevicesService();
      const service = makeService({
        membershipsRepo,
        dataSource,
        auditLogService,
        devicesService,
      });

      const result = await service.update('org-1', 'membership-1', 'admin-1', {
        deactivate: true,
      });

      expect(result.status).toBe(MembershipStatus.DEACTIVATED);
      expect(save).toHaveBeenCalledWith(
        Membership,
        expect.objectContaining({ status: MembershipStatus.DEACTIVATED }),
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'membership.updated',
          metadata: expect.objectContaining({ deactivated: true }) as unknown,
        }),
      );
      expect(signOutAllForUser).toHaveBeenCalledWith(
        expect.anything(),
        'org-1',
        'user-1',
        'admin-1',
      );
    });

    it('does not sign out devices when the membership is not being deactivated', async () => {
      const caller = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const { dataSource } = makeDataSource();
      const { devicesService, signOutAllForUser } = makeDevicesService();
      const service = makeService({
        membershipsRepo,
        dataSource,
        devicesService,
      });

      await service.update('org-1', 'membership-1', 'admin-1', {
        role: MembershipRole.MANAGER,
      });

      expect(signOutAllForUser).not.toHaveBeenCalled();
    });

    it('rejects demoting the last admin', async () => {
      const caller = {
        id: 'admin-membership-1',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({
        findOne,
        count: jest.fn().mockResolvedValue(0),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'membership-1', 'admin-1', {
          role: MembershipRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects deactivating the last admin', async () => {
      const caller = {
        id: 'admin-membership-1',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({
        findOne,
        count: jest.fn().mockResolvedValue(0),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'membership-1', 'admin-1', {
          deactivate: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows demoting an admin when another admin remains', async () => {
      const caller = {
        id: 'admin-membership-1',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const count = jest.fn().mockResolvedValue(1);
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({ findOne, count });
      const { dataSource } = makeDataSource();
      const service = makeService({ membershipsRepo, dataSource });

      const result = await service.update('org-1', 'membership-1', 'admin-1', {
        role: MembershipRole.MEMBER,
      });

      expect(result.role).toBe(MembershipRole.MEMBER);
      expect(count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: 'org-1',
            role: MembershipRole.ADMIN,
            status: MembershipStatus.ACTIVE,
          }) as unknown,
        }),
      );
    });

    it('rejects an admin deactivating their own membership', async () => {
      const admin = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'admin@b.test', name: 'Admin' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(admin);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'admin-membership', 'admin-1', {
          deactivate: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an admin changing their own role', async () => {
      const admin = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'admin@b.test', name: 'Admin' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(admin);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'admin-membership', 'admin-1', {
          role: MembershipRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("allows an admin to deactivate another admin's membership", async () => {
      const caller = {
        id: 'admin-membership-1',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const target = {
        id: 'admin-membership-2',
        userId: 'admin-2',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'admin2@b.test', name: 'Admin Two' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const count = jest.fn().mockResolvedValue(1);
      const membershipsRepo = makeMembershipsRepo({ findOne, count });
      const { dataSource } = makeDataSource();
      const service = makeService({ membershipsRepo, dataSource });

      const result = await service.update(
        'org-1',
        'admin-membership-2',
        'admin-1',
        { deactivate: true },
      );

      expect(result.status).toBe(MembershipStatus.DEACTIVATED);
    });

    it("allows an admin to change another admin's role", async () => {
      const caller = {
        id: 'admin-membership-1',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const target = {
        id: 'admin-membership-2',
        userId: 'admin-2',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'admin2@b.test', name: 'Admin Two' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const count = jest.fn().mockResolvedValue(1);
      const membershipsRepo = makeMembershipsRepo({ findOne, count });
      const { dataSource } = makeDataSource();
      const service = makeService({ membershipsRepo, dataSource });

      const result = await service.update(
        'org-1',
        'admin-membership-2',
        'admin-1',
        { role: MembershipRole.MANAGER },
      );

      expect(result.role).toBe(MembershipRole.MANAGER);
    });

    it('allows an admin to promote another member to admin', async () => {
      const caller = {
        id: 'admin-membership-1',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const target = {
        id: 'membership-2',
        userId: 'user-2',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'user2@b.test', name: 'User Two' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const { dataSource } = makeDataSource();
      const service = makeService({ membershipsRepo, dataSource });

      const result = await service.update('org-1', 'membership-2', 'admin-1', {
        role: MembershipRole.ADMIN,
      });

      expect(result.role).toBe(MembershipRole.ADMIN);
    });

    it('does not check last-admin status for a non-admin role change', async () => {
      const caller = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const count = jest.fn().mockResolvedValue(0);
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const membershipsRepo = makeMembershipsRepo({ findOne, count });
      const { dataSource } = makeDataSource();
      const service = makeService({ membershipsRepo, dataSource });

      await service.update('org-1', 'membership-1', 'admin-1', {
        deactivate: true,
      });

      expect(count).not.toHaveBeenCalled();
    });

    it('allows a manager to modify a member on a team they manage', async () => {
      const caller = {
        id: 'manager-membership',
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [{ teamId: 'team-1', isManager: false }],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const { dataSource } = makeDataSource();
      const service = makeService({ membershipsRepo, dataSource });

      const result = await service.update(
        'org-1',
        'membership-1',
        'manager-1',
        { deactivate: true },
      );

      expect(result.status).toBe(MembershipStatus.DEACTIVATED);
    });

    it.each([
      { timesheetModifyTime: 'add_edit' },
      { timesheetRequireApproval: false },
      { appUrlTracking: 'off' },
      { allowedApps: 'all' },
    ] as const)(
      "rejects a manager changing a team member's setting override %p",
      async (dto) => {
        const findOne = jest
          .fn()
          .mockResolvedValueOnce({
            id: 'manager-membership',
            role: MembershipRole.MANAGER,
            teamMemberships: [{ teamId: 'team-1', isManager: true }],
          })
          .mockResolvedValueOnce({
            id: 'membership-1',
            userId: 'user-1',
            role: MembershipRole.MEMBER,
            teamMemberships: [{ teamId: 'team-1', isManager: false }],
            status: MembershipStatus.ACTIVE,
            user: { email: 'a@b.test', name: 'A B' },
          });
        const service = makeService({
          membershipsRepo: makeMembershipsRepo({ findOne }),
        });

        await expect(
          service.update('org-1', 'membership-1', 'manager-1', dto),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it('allows a manager to modify a member who is also on another team the manager does not manage', async () => {
      const caller = {
        id: 'manager-membership',
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [
          { teamId: 'team-1', isManager: false },
          { teamId: 'team-2', isManager: false },
        ],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const { dataSource } = makeDataSource();
      const service = makeService({ membershipsRepo, dataSource });

      const result = await service.update(
        'org-1',
        'membership-1',
        'manager-1',
        { deactivate: true },
      );

      expect(result.status).toBe(MembershipStatus.DEACTIVATED);
    });

    it('rejects a manager modifying their own membership', async () => {
      const membership = {
        id: 'manager-membership',
        userId: 'manager-1',
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'manager@b.test', name: 'Manager' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(membership)
        .mockResolvedValueOnce(membership);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'manager-membership', 'manager-1', {
          deactivate: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a manager changing their own role', async () => {
      const membership = {
        id: 'manager-membership',
        userId: 'manager-1',
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'manager@b.test', name: 'Manager' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(membership)
        .mockResolvedValueOnce(membership);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'manager-membership', 'manager-1', {
          role: MembershipRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a manager modifying a target who is currently an admin', async () => {
      const caller = {
        id: 'manager-membership',
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [{ teamId: 'team-1', isManager: false }],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'membership-1', 'manager-1', {
          deactivate: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a manager trying to grant admin to a member', async () => {
      const caller = {
        id: 'manager-membership',
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [{ teamId: 'team-1', isManager: false }],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'membership-1', 'manager-1', {
          role: MembershipRole.ADMIN,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a manager modifying a member outside every team they manage', async () => {
      const caller = {
        id: 'manager-membership',
        role: MembershipRole.MANAGER,
        teamMemberships: [{ teamId: 'team-1', isManager: true }],
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [{ teamId: 'team-2', isManager: false }],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'membership-1', 'manager-1', {
          deactivate: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a manager who manages no team modifying anyone', async () => {
      const caller = {
        id: 'manager-membership',
        role: MembershipRole.MANAGER,
        teamMemberships: [],
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const membershipsRepo = makeMembershipsRepo({ findOne });
      const service = makeService({ membershipsRepo });

      await expect(
        service.update('org-1', 'membership-1', 'manager-1', {
          deactivate: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sets the per-member appUrlTracking override', async () => {
      const caller = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        appUrlTracking: null,
        expectedWorkDays: null,
        trackingDisabledDays: null,
        expectedWeeklyHours: null,
        weeklyLimitHours: null,
        dailyLimitHours: null,
        canDeleteScreenshots: null,
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const { dataSource, save } = makeDataSource();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        dataSource,
      });

      const result = await service.update('org-1', 'membership-1', 'admin-1', {
        appUrlTracking: 'apps_urls',
      });

      expect(result.appUrlTracking).toBe('apps_urls');
      expect(save).toHaveBeenCalledWith(
        Membership,
        expect.objectContaining({ appUrlTracking: 'apps_urls' }),
      );
    });

    it('clears the override when appUrlTracking is null', async () => {
      const caller = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        appUrlTracking: 'apps',
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const { dataSource, save } = makeDataSource();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        dataSource,
      });

      const result = await service.update('org-1', 'membership-1', 'admin-1', {
        appUrlTracking: null,
        expectedWorkDays: null,
        trackingDisabledDays: null,
        expectedWeeklyHours: null,
        weeklyLimitHours: null,
        dailyLimitHours: null,
        canDeleteScreenshots: null,
      });

      expect(result.appUrlTracking).toBeNull();
      expect(save).toHaveBeenCalledWith(
        Membership,
        expect.objectContaining({ appUrlTracking: null }),
      );
    });
  });

  describe('resetAllAppUrlTrackingOverrides', () => {
    function makeUpdateBuilder(affected: number) {
      const qb = {
        update: jest.fn(),
        set: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        execute: jest.fn().mockResolvedValue({ affected }),
      };
      qb.update.mockReturnValue(qb);
      qb.set.mockReturnValue(qb);
      qb.where.mockReturnValue(qb);
      qb.andWhere.mockReturnValue(qb);
      return qb;
    }

    it('clears every override for the organisation and records one audit entry', async () => {
      const builder = makeUpdateBuilder(3);
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({
          createQueryBuilder: jest.fn().mockReturnValue(builder),
        }),
        auditLogService,
      });

      const result = await service.resetAllAppUrlTrackingOverrides(
        'org-1',
        'admin-1',
      );

      expect(result).toEqual({ cleared: 3 });
      expect(builder.set).toHaveBeenCalledWith({ appUrlTracking: null });
      expect(builder.where).toHaveBeenCalledWith(
        'organisationId = :organisationId',
        { organisationId: 'org-1' },
      );
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'membership.app_url_tracking_overrides_reset',
          organisationId: 'org-1',
          actorUserId: 'admin-1',
        }),
      );
    });

    it('skips the audit entry when nothing was cleared', async () => {
      const builder = makeUpdateBuilder(0);
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({
          createQueryBuilder: jest.fn().mockReturnValue(builder),
        }),
        auditLogService,
      });

      const result = await service.resetAllAppUrlTrackingOverrides(
        'org-1',
        'admin-1',
      );

      expect(result).toEqual({ cleared: 0 });
      expect(record).not.toHaveBeenCalled();
    });
  });

  describe('resetAllTimesheetOverrides', () => {
    function makeUpdateBuilder(affected: number) {
      const qb = {
        update: jest.fn(),
        set: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        execute: jest.fn().mockResolvedValue({ affected }),
      };
      qb.update.mockReturnValue(qb);
      qb.set.mockReturnValue(qb);
      qb.where.mockReturnValue(qb);
      qb.andWhere.mockReturnValue(qb);
      return qb;
    }

    it('clears both timesheet overrides for the organisation and records one audit entry', async () => {
      const builder = makeUpdateBuilder(4);
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({
          createQueryBuilder: jest.fn().mockReturnValue(builder),
        }),
        auditLogService,
      });

      const result = await service.resetAllTimesheetOverrides(
        'org-1',
        'admin-1',
      );

      expect(result).toEqual({ cleared: 4 });
      expect(builder.set).toHaveBeenCalledWith({
        timesheetModifyTime: null,
        timesheetRequireApproval: null,
      });
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'membership.timesheet_overrides_reset',
          organisationId: 'org-1',
          actorUserId: 'admin-1',
        }),
      );
    });
  });

  describe('update — timesheet overrides', () => {
    it('sets both timesheet overrides when provided', async () => {
      const caller = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        timesheetModifyTime: null,
        timesheetRequireApproval: null,
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const { dataSource, save } = makeDataSource();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        dataSource,
      });

      const result = await service.update('org-1', 'membership-1', 'admin-1', {
        timesheetModifyTime: 'off',
        timesheetRequireApproval: true,
      });

      expect(result.timesheetModifyTime).toBe('off');
      expect(result.timesheetRequireApproval).toBe(true);
      expect(save).toHaveBeenCalledWith(
        Membership,
        expect.objectContaining({
          timesheetModifyTime: 'off',
          timesheetRequireApproval: true,
        }),
      );
    });

    it('clears each override when passed null', async () => {
      const caller = {
        id: 'admin-membership',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamMemberships: [],
      };
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [],
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        timesheetModifyTime: 'off',
        timesheetRequireApproval: true,
        user: { email: 'a@b.test', name: 'A B' },
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(membership);
      const { dataSource } = makeDataSource();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        dataSource,
      });

      const result = await service.update('org-1', 'membership-1', 'admin-1', {
        timesheetModifyTime: null,
        timesheetRequireApproval: null,
      });

      expect(result.timesheetModifyTime).toBeNull();
      expect(result.timesheetRequireApproval).toBeNull();
    });
  });

  describe('sendPasswordResets', () => {
    const admin = {
      id: 'admin-membership',
      userId: 'admin-1',
      role: MembershipRole.ADMIN,
      teamMemberships: [],
    };

    function target(overrides: Record<string, unknown> = {}) {
      return {
        id: 'membership-1',
        role: MembershipRole.MEMBER,
        teamMemberships: [{ teamId: 'team-1', isManager: false }],
        user: { email: 'a@b.test', passwordHash: 'hash' },
        ...overrides,
      };
    }

    it('emails the standard reset link and records it in the audit log', async () => {
      const { authService, forgotPassword } = makeAuthService();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue(admin),
          find: jest.fn().mockResolvedValue([target()]),
        }),
        authService,
        auditLogService,
      });

      const results = await service.sendPasswordResets('org-1', 'admin-1', [
        'membership-1',
      ]);

      expect(forgotPassword).toHaveBeenCalledWith({ email: 'a@b.test' });
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'membership.password_reset_sent' }),
      );
      expect(results).toEqual([
        { membershipId: 'membership-1', email: 'a@b.test', outcome: 'sent' },
      ]);
    });

    it('skips the caller themselves, unknown members, and anyone without a password', async () => {
      const { authService, forgotPassword } = makeAuthService();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue(admin),
          find: jest.fn().mockResolvedValue([
            target({
              id: 'admin-membership',
              user: { email: 'me@b.test', passwordHash: 'h' },
            }),
            target({
              id: 'membership-2',
              user: { email: 'new@b.test', passwordHash: null },
            }),
          ]),
        }),
        authService,
      });

      const results = await service.sendPasswordResets('org-1', 'admin-1', [
        'admin-membership',
        'membership-2',
        'membership-missing',
      ]);

      expect(forgotPassword).not.toHaveBeenCalled();
      expect(results.map((result) => result.outcome)).toEqual([
        'skipped',
        'skipped',
        'skipped',
      ]);
    });

    it("skips admins and people outside a manager caller's teams", async () => {
      const { authService, forgotPassword } = makeAuthService();
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({
            id: 'manager-membership',
            role: MembershipRole.MANAGER,
            teamMemberships: [{ teamId: 'team-1', isManager: true }],
          }),
          find: jest.fn().mockResolvedValue([
            target({ id: 'on-team' }),
            target({ id: 'an-admin', role: MembershipRole.ADMIN }),
            target({
              id: 'other-team',
              teamMemberships: [{ teamId: 'team-2', isManager: false }],
            }),
          ]),
        }),
        authService,
      });

      const results = await service.sendPasswordResets('org-1', 'manager-1', [
        'on-team',
        'an-admin',
        'other-team',
      ]);

      expect(forgotPassword).toHaveBeenCalledTimes(1);
      expect(
        results.map((result) => [result.membershipId, result.outcome]),
      ).toEqual([
        ['on-team', 'sent'],
        ['an-admin', 'skipped'],
        ['other-team', 'skipped'],
      ]);
    });
  });
});
