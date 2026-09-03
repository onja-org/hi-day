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

describe('MembershipsService', () => {
  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
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

  function makeDevicesService() {
    const signOutAllForUser = jest.fn().mockResolvedValue(undefined);
    return {
      devicesService: { signOutAllForUser } as unknown as DevicesService,
      signOutAllForUser,
    };
  }

  function makeService(
    overrides: {
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
      devicesService?: DevicesService;
    } = {},
  ) {
    return new MembershipsService(
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
      overrides.devicesService ?? makeDevicesService().devicesService,
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
      const findOne = jest
        .fn()
        .mockResolvedValue({ role: MembershipRole.ADMIN, teamId: null });
      const find = jest.fn().mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          role: MembershipRole.MEMBER,
          teamId: 'team-2',
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
          teamId: 'team-2',
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date('2026-01-01'),
        },
      ]);
    });

    it("scopes the list to the manager caller's own team", async () => {
      const findOne = jest
        .fn()
        .mockResolvedValue({ role: MembershipRole.MANAGER, teamId: 'team-1' });
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne, find }),
      });

      await service.listActiveForOrganisation('org-1', 'caller-1');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: 'org-1',
            status: MembershipStatus.ACTIVE,
            teamId: 'team-1',
          },
        }),
      );
    });

    it('returns no members for a teamless manager without querying every other teamless membership', async () => {
      const findOne = jest
        .fn()
        .mockResolvedValue({ role: MembershipRole.MANAGER, teamId: null });
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne, find }),
      });

      const summaries = await service.listActiveForOrganisation(
        'org-1',
        'caller-1',
      );

      expect(summaries).toEqual([]);
      expect(find).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
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
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: null,
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
      });
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
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: null,
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
      });
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
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: null,
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
      });
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
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.ADMIN,
        teamId: null,
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
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
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.ADMIN,
        teamId: null,
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
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
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.ADMIN,
        teamId: null,
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const count = jest.fn().mockResolvedValue(1);
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
        count,
      });
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

    it('does not check last-admin status for a non-admin role change', async () => {
      const membership = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: null,
        status: MembershipStatus.ACTIVE,
        deactivatedAt: null,
        createdAt: new Date('2026-01-01'),
        user: { email: 'a@b.test', name: 'A B' },
      };
      const count = jest.fn().mockResolvedValue(0);
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(membership),
        count,
      });
      const { dataSource } = makeDataSource();
      const service = makeService({ membershipsRepo, dataSource });

      await service.update('org-1', 'membership-1', 'admin-1', {
        deactivate: true,
      });

      expect(count).not.toHaveBeenCalled();
    });

    it('allows a manager to modify a member on their own team', async () => {
      const caller = {
        id: 'manager-membership',
        role: MembershipRole.MANAGER,
        teamId: 'team-1',
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: 'team-1',
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
        teamId: 'team-1',
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
        teamId: 'team-1',
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
        teamId: 'team-1',
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.ADMIN,
        teamId: 'team-1',
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
        teamId: 'team-1',
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: 'team-1',
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

    it('rejects a manager modifying a member outside their team', async () => {
      const caller = {
        id: 'manager-membership',
        role: MembershipRole.MANAGER,
        teamId: 'team-1',
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: 'team-2',
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

    it('rejects a teamless manager modifying anyone', async () => {
      const caller = {
        id: 'manager-membership',
        role: MembershipRole.MANAGER,
        teamId: null,
      };
      const target = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: null,
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
  });
});
