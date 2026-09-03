import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Activity } from '../../../database/entities/activity.entity';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { ActivitiesService } from '../activities.service';

describe('ActivitiesService', () => {
  function makeActivitiesRepo(overrides: Partial<Repository<Activity>> = {}) {
    return {
      find: jest.fn().mockResolvedValue([]),
      ...overrides,
    } as unknown as Repository<Activity>;
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn(),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeDataSource() {
    const save = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn((_entity: unknown, plain: object) => ({
      id: 'activity-1',
      createdAt: new Date('2026-01-01'),
      ...plain,
    }));
    const manager = { save, create } as unknown as EntityManager;
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
      activitiesRepo?: Repository<Activity>;
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new ActivitiesService(
      overrides.activitiesRepo ?? makeActivitiesRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  describe('create', () => {
    it('saves the entry and records an audit log entry', async () => {
      const { dataSource, save } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ dataSource, auditLogService });

      const entry = await service.create('org-1', 'user-1', {
        content: 'Working on the report.',
      });

      expect(entry).toEqual(
        expect.objectContaining({
          id: 'activity-1',
          userId: 'user-1',
          content: 'Working on the report.',
        }),
      );
      expect(save).toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'activity.created' }),
      );
    });
  });

  describe('listMine', () => {
    it("returns only the caller's own entries", async () => {
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        activitiesRepo: makeActivitiesRepo({ find }),
      });

      await service.listMine('org-1', 'user-1');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: 'org-1', userId: 'user-1' },
        }),
      );
    });
  });

  describe('listForMembership', () => {
    it('throws when either membership cannot be found', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.listForMembership('org-1', 'caller-1', 'membership-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows a member to view their own activity', async () => {
      const self = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: null,
        status: MembershipStatus.ACTIVE,
      };
      const findOne = jest.fn().mockResolvedValue(self);
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        activitiesRepo: makeActivitiesRepo({ find }),
      });

      await service.listForMembership('org-1', 'user-1', 'membership-1');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: 'org-1', userId: 'user-1' },
        }),
      );
    });

    it('denies a member viewing a peer', async () => {
      const caller = {
        id: 'membership-1',
        userId: 'user-1',
        role: MembershipRole.MEMBER,
        teamId: 'team-1',
        status: MembershipStatus.ACTIVE,
      };
      const target = {
        id: 'membership-2',
        userId: 'user-2',
        role: MembershipRole.MEMBER,
        teamId: 'team-1',
        status: MembershipStatus.ACTIVE,
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
      });

      await expect(
        service.listForMembership('org-1', 'user-1', 'membership-2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("allows a manager to view a member on the manager's team", async () => {
      const caller = {
        id: 'membership-1',
        userId: 'manager-1',
        role: MembershipRole.MANAGER,
        teamId: 'team-1',
        status: MembershipStatus.ACTIVE,
      };
      const target = {
        id: 'membership-2',
        userId: 'user-2',
        role: MembershipRole.MEMBER,
        teamId: 'team-1',
        status: MembershipStatus.ACTIVE,
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        activitiesRepo: makeActivitiesRepo({ find }),
      });

      await service.listForMembership('org-1', 'manager-1', 'membership-2');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: 'org-1', userId: 'user-2' },
        }),
      );
    });

    it('allows an admin to view anyone', async () => {
      const caller = {
        id: 'membership-1',
        userId: 'admin-1',
        role: MembershipRole.ADMIN,
        teamId: null,
        status: MembershipStatus.ACTIVE,
      };
      const target = {
        id: 'membership-2',
        userId: 'user-2',
        role: MembershipRole.MEMBER,
        teamId: 'team-9',
        status: MembershipStatus.ACTIVE,
      };
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(caller)
        .mockResolvedValueOnce(target);
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ findOne }),
        activitiesRepo: makeActivitiesRepo({ find }),
      });

      await expect(
        service.listForMembership('org-1', 'admin-1', 'membership-2'),
      ).resolves.toEqual([]);
    });
  });
});
