import { NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
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
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new MembershipsService(
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  describe('listActiveForOrganisation', () => {
    it('lists only active memberships, mapped to a summary shape', async () => {
      const find = jest.fn().mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          role: MembershipRole.MEMBER,
          teamId: null,
          status: MembershipStatus.ACTIVE,
          createdAt: new Date('2026-01-01'),
          user: { email: 'a@b.test', name: 'A B' },
        },
      ]);
      const service = makeService({
        membershipsRepo: makeMembershipsRepo({ find }),
      });

      const summaries = await service.listActiveForOrganisation('org-1');

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
          teamId: null,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date('2026-01-01'),
        },
      ]);
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
      const service = makeService({
        membershipsRepo,
        dataSource,
        auditLogService,
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
    });
  });
});
