import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../../database/entities/membership-status.enum';
import { TimeEntry } from '../../../database/entities/time-entry.entity';
import { TimeEntriesService } from '../time-entries.service';

describe('TimeEntriesService', () => {
  function makeTimeEntriesRepo(overrides: Partial<Repository<TimeEntry>> = {}) {
    return {
      find: jest.fn().mockResolvedValue([]),
      ...overrides,
    } as unknown as Repository<TimeEntry>;
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
      id: 'time-entry-1',
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
      timeEntriesRepo?: Repository<TimeEntry>;
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new TimeEntriesService(
      overrides.timeEntriesRepo ?? makeTimeEntriesRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  describe('create', () => {
    it('saves the entry, records an audit log entry, and returns the derived duration', async () => {
      const { dataSource, save } = makeDataSource();
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({ dataSource, auditLogService });

      const entry = await service.create('org-1', 'user-1', {
        startedAt: '2026-01-01T09:00:00.000Z',
        endedAt: '2026-01-01T11:30:00.000Z',
        note: 'Worked on the report.',
      });

      expect(entry).toEqual(
        expect.objectContaining({
          id: 'time-entry-1',
          userId: 'user-1',
          durationMinutes: 150,
          note: 'Worked on the report.',
        }),
      );
      expect(save).toHaveBeenCalled();
      expect(record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'time_entry.created' }),
      );
    });

    it('rejects an end time that is not after the start time', async () => {
      const service = makeService();

      await expect(
        service.create('org-1', 'user-1', {
          startedAt: '2026-01-01T11:00:00.000Z',
          endedAt: '2026-01-01T09:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an end time equal to the start time', async () => {
      const service = makeService();

      await expect(
        service.create('org-1', 'user-1', {
          startedAt: '2026-01-01T09:00:00.000Z',
          endedAt: '2026-01-01T09:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listMine', () => {
    it("returns only the caller's own entries", async () => {
      const find = jest.fn().mockResolvedValue([]);
      const service = makeService({
        timeEntriesRepo: makeTimeEntriesRepo({ find }),
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

    it('allows a member to view their own timesheet', async () => {
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
        timeEntriesRepo: makeTimeEntriesRepo({ find }),
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
        timeEntriesRepo: makeTimeEntriesRepo({ find }),
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
        timeEntriesRepo: makeTimeEntriesRepo({ find }),
      });

      await expect(
        service.listForMembership('org-1', 'admin-1', 'membership-2'),
      ).resolves.toEqual([]);
    });
  });
});
