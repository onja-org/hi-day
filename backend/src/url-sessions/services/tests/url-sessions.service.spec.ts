import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, Not, Repository } from 'typeorm';
import { AuditLogService } from '../../../audit-log/services/audit-log.service';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { UrlSession } from '../../../database/entities/url-session.entity';
import { UrlSessionConfidence } from '../../../database/entities/url-session-confidence.enum';
import { UrlSessionSource } from '../../../database/entities/url-session-source.enum';
import { UrlSessionEntryDto } from '../../dto/url-session-entry.dto';
import { UrlSessionsService } from '../url-sessions.service';

describe('UrlSessionsService', () => {
  function makeUrlSessionsRepo(
    overrides: Partial<Repository<UrlSession>> = {},
  ) {
    return {
      upsert: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      ...overrides,
    } as unknown as Repository<UrlSession>;
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

  function makeDataSource() {
    const manager = {} as unknown as EntityManager;
    const transaction = jest.fn(
      (fn: (manager: EntityManager) => Promise<unknown>) => fn(manager),
    );
    return { dataSource: { transaction } as unknown, transaction };
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
      urlSessionsRepo?: Repository<UrlSession>;
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
    } = {},
  ) {
    return new UrlSessionsService(
      overrides.urlSessionsRepo ?? makeUrlSessionsRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
    );
  }

  function makeEntry(
    overrides: Partial<UrlSessionEntryDto> = {},
  ): UrlSessionEntryDto {
    return {
      id: 'session-1',
      url: 'https://example.com/page',
      host: 'example.com',
      path: '/page',
      title: 'Example Page',
      browser: 'chrome',
      private: false,
      deviceId: 'device-from-client-should-be-ignored',
      startedAt: Date.parse('2026-01-01T09:00:00Z'),
      endedAt: Date.parse('2026-01-01T09:05:00Z'),
      activeMs: 300_000,
      tzOffsetMin: 0,
      source: UrlSessionSource.APPLE_EVENTS,
      confidence: UrlSessionConfidence.EXACT,
      ...overrides,
    };
  }

  describe('sync', () => {
    it('upserts every session using the authenticated deviceId, ignoring the DTO deviceId', async () => {
      const upsert = jest.fn().mockResolvedValue(undefined);
      const urlSessionsRepo = makeUrlSessionsRepo({ upsert });
      const service = makeService({ urlSessionsRepo });

      const result = await service.sync('org-1', 'user-1', 'device-real', [
        makeEntry({ id: 'session-1' }),
        makeEntry({ id: 'session-2' }),
      ]);

      expect(result.acked).toEqual(['session-1', 'session-2']);
      expect(upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({ id: 'session-1', deviceId: 'device-real' }),
          expect.objectContaining({ id: 'session-2', deviceId: 'device-real' }),
        ],
        ['id'],
      );
    });

    it('rejects a caller with no active organisation membership', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.sync('org-1', 'user-1', 'device-1', [makeEntry()]),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('listGroupedByUrl', () => {
    it('sums activeMs across sessions for the same url and keeps the most recent title', async () => {
      const urlSessionsRepo = makeUrlSessionsRepo({
        find: jest.fn().mockResolvedValue([
          {
            url: 'https://example.com/page',
            host: 'example.com',
            title: 'Newer title',
            activeMs: 120_000,
            endedAt: new Date('2026-01-02T09:00:00Z'),
          },
          {
            url: 'https://example.com/page',
            host: 'example.com',
            title: 'Older title',
            activeMs: 300_000,
            endedAt: new Date('2026-01-01T09:05:00Z'),
          },
        ]),
      });
      const service = makeService({ urlSessionsRepo });

      const result = await service.listGroupedByUrl('org-1', 'user-1');

      expect(result).toEqual([
        {
          url: 'https://example.com/page',
          host: 'example.com',
          title: 'Newer title',
          totalActiveMs: 420_000,
          lastVisitedAt: new Date('2026-01-02T09:00:00Z'),
          sessionCount: 2,
        },
      ]);
    });

    it("queries excluding empty (private) urls, scoped to the caller's own membership by default", async () => {
      const find = jest.fn().mockResolvedValue([]);
      const urlSessionsRepo = makeUrlSessionsRepo({ find });
      const service = makeService({ urlSessionsRepo });

      await service.listGroupedByUrl('org-1', 'user-1');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { membershipId: 'm-1', url: Not('') },
        }),
      );
    });

    it("rejects a plain member trying to view another member's activity", async () => {
      const service = makeService();

      await expect(
        service.listGroupedByUrl('org-1', 'user-1', 'other-membership'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("lets an admin view another member's activity by membershipId", async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 'm-admin', role: MembershipRole.ADMIN })
          .mockResolvedValueOnce({ id: 'other-membership' }),
      });
      const find = jest.fn().mockResolvedValue([]);
      const urlSessionsRepo = makeUrlSessionsRepo({ find });
      const service = makeService({ membershipsRepo, urlSessionsRepo });

      await service.listGroupedByUrl('org-1', 'user-1', 'other-membership');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { membershipId: 'other-membership', url: Not('') },
        }),
      );
    });
  });

  describe('deleteByUrl', () => {
    it('deletes every session for that membership+url and records an audit log entry', async () => {
      const deleteFn = jest.fn().mockResolvedValue({ affected: 3 });
      const urlSessionsRepo = makeUrlSessionsRepo({ delete: deleteFn });
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'target-membership' }),
      });
      const { auditLogService, record } = makeAuditLogService();
      const service = makeService({
        urlSessionsRepo,
        membershipsRepo,
        auditLogService,
      });

      await service.deleteByUrl(
        'org-1',
        'admin-user',
        'target-membership',
        'https://example.com/page',
      );

      expect(deleteFn).toHaveBeenCalledWith({
        organisationId: 'org-1',
        membershipId: 'target-membership',
        url: 'https://example.com/page',
      });
      const calls = record.mock.calls as unknown as [
        unknown,
        { action: string; metadata: { deletedCount: number } },
      ][];
      const recordedInput = calls[0][1];
      expect(recordedInput.action).toBe('url_session.deleted_by_url');
      expect(recordedInput.metadata.deletedCount).toBe(3);
    });

    it('rejects when membershipId or url is missing', async () => {
      const service = makeService();

      await expect(
        service.deleteByUrl('org-1', 'admin-user', '', 'https://example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.deleteByUrl('org-1', 'admin-user', 'target-membership', ''),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s when the target member does not exist in this organisation', async () => {
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const service = makeService({ membershipsRepo });

      await expect(
        service.deleteByUrl(
          'org-1',
          'admin-user',
          'missing',
          'https://example.com',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
