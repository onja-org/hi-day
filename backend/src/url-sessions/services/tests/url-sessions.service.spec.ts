import type { CaptureSettings } from '../../../organisations/capture-settings';
import { OrganisationsService } from '../../../organisations/services/organisations.service';
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
import { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import { UrlSessionEntryDto } from '../../dto/url-session-entry.dto';
import { UrlSessionsService } from '../url-sessions.service';

type FakeCoveringEntry = {
  id: string;
  projectId: string | null;
  startedAt: Date;
  endedAt: Date | null;
};

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

  const ALL_DAY: FakeCoveringEntry = {
    id: 'entry-day',
    projectId: 'project-day',
    startedAt: new Date('2026-09-08T00:00:00.000Z'),
    endedAt: new Date('2026-09-09T00:00:00.000Z'),
  };

  function makeTimeEntriesService(
    coveringEntries: FakeCoveringEntry[] = [ALL_DAY],
  ) {
    return {
      listCoveringWindow: jest.fn().mockResolvedValue(coveringEntries),
    } as unknown as TimeEntriesService;
  }

  function makeOrganisationsService(
    overrides: Partial<CaptureSettings> = {},
  ): OrganisationsService {
    return {
      getCaptureSettings: jest.fn().mockResolvedValue({
        windowTrackingEnabled: true,
        appUrlTracking: 'apps_urls',
        screenshotsEnabled: false,
        screenshotFrequencySeconds: 600,
        screenshotRetentionDays: 30,
        ...overrides,
      }),
    } as unknown as OrganisationsService;
  }

  function makeService(
    overrides: {
      urlSessionsRepo?: Repository<UrlSession>;
      membershipsRepo?: Repository<Membership>;
      dataSource?: unknown;
      auditLogService?: AuditLogService;
      timeEntriesService?: TimeEntriesService;
      organisationsService?: OrganisationsService;
    } = {},
  ) {
    return new UrlSessionsService(
      overrides.urlSessionsRepo ?? makeUrlSessionsRepo(),
      overrides.membershipsRepo ?? makeMembershipsRepo(),
      (overrides.dataSource ?? makeDataSource().dataSource) as never,
      overrides.auditLogService ?? makeAuditLogService().auditLogService,
      overrides.timeEntriesService ?? makeTimeEntriesService(),
      overrides.organisationsService ?? makeOrganisationsService(),
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

    it('drops page titles while window titles are off', async () => {
      const upsert = jest.fn().mockResolvedValue(undefined);
      const service = makeService({
        urlSessionsRepo: makeUrlSessionsRepo({ upsert }),
        organisationsService: makeOrganisationsService({
          windowTrackingEnabled: false,
        }),
      });

      await service.sync('org-1', 'user-1', 'device-real', [makeEntry()]);

      expect(upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            url: 'https://example.com/page',
            title: null,
          }),
        ],
        ['id'],
      );
    });

    it('acks without storing when URL tracking is not enabled for this member', async () => {
      const upsert = jest.fn().mockResolvedValue(undefined);
      const service = makeService({
        urlSessionsRepo: makeUrlSessionsRepo({ upsert }),
        organisationsService: makeOrganisationsService({
          appUrlTracking: 'apps',
        }),
      });

      const result = await service.sync('org-1', 'user-1', 'device-1', [
        makeEntry({ id: 'session-1' }),
      ]);

      // Acked so the agent drops them, rather than retrying the batch forever.
      expect(result.acked).toEqual(['session-1']);
      expect(upsert).not.toHaveBeenCalled();
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
          where: { organisationId: 'org-1', membershipId: 'm-1', url: Not('') },
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
          where: {
            organisationId: 'org-1',
            membershipId: 'other-membership',
            url: Not(''),
          },
        }),
      );
    });
  });

  describe('getDayGroupedByUrl', () => {
    function makeSessionRow(overrides: Partial<UrlSession> = {}): UrlSession {
      return {
        id: 'session-1',
        url: 'https://example.com/page',
        host: 'example.com',
        title: 'Example Page',
        startedAt: new Date('2026-09-08T09:00:00.000Z'),
        endedAt: new Date('2026-09-08T09:05:00.000Z'),
        activeMs: 60_000,
        ...overrides,
      } as UrlSession;
    }

    it('buckets sessions by hour and sums activeMs whole, never split', async () => {
      const rows = [
        makeSessionRow({
          startedAt: new Date('2026-09-08T09:00:00.000Z'),
          activeMs: 60_000,
        }),
        makeSessionRow({
          startedAt: new Date('2026-09-08T09:30:00.000Z'),
          activeMs: 30_000,
        }),
        makeSessionRow({
          url: 'https://other.example/',
          host: 'other.example',
          startedAt: new Date('2026-09-08T10:00:00.000Z'),
          activeMs: 15_000,
        }),
      ];
      const urlSessionsRepo = makeUrlSessionsRepo({
        find: jest.fn().mockResolvedValue(rows),
      });
      const service = makeService({ urlSessionsRepo });

      const day = await service.getDayGroupedByUrl(
        'org-1',
        'user-1',
        '2026-09-08',
      );

      expect(day.date).toBe('2026-09-08');
      expect(day.totalActiveMs).toBe(105_000);
      expect(day.buckets).toEqual([
        {
          hourStart: '2026-09-08T09:00:00.000Z',
          pages: [
            {
              projectId: 'project-day',
              url: 'https://example.com/page',
              host: 'example.com',
              title: 'Example Page',
              activeMs: 90_000,
              sessionCount: 2,
            },
          ],
        },
        {
          hourStart: '2026-09-08T10:00:00.000Z',
          pages: [
            {
              projectId: 'project-day',
              url: 'https://other.example/',
              host: 'other.example',
              title: 'Example Page',
              activeMs: 15_000,
              sessionCount: 1,
            },
          ],
        },
      ]);
    });

    it('attributes a session to whichever project covered its startedAt', async () => {
      const rows = [
        makeSessionRow({ startedAt: new Date('2026-09-08T09:00:00.000Z') }),
      ];
      const urlSessionsRepo = makeUrlSessionsRepo({
        find: jest.fn().mockResolvedValue(rows),
      });
      const coveringEntries: FakeCoveringEntry[] = [
        {
          id: 'te-1',
          projectId: 'project-1',
          startedAt: new Date('2026-09-08T08:00:00.000Z'),
          endedAt: new Date('2026-09-08T10:00:00.000Z'),
        },
      ];
      const service = makeService({
        urlSessionsRepo,
        timeEntriesService: makeTimeEntriesService(coveringEntries),
      });

      const day = await service.getDayGroupedByUrl(
        'org-1',
        'user-1',
        '2026-09-08',
      );

      expect(day.buckets[0].pages[0].projectId).toBe('project-1');
    });

    // Sessions outside every entry are dropped rather than labelled
    // "untracked", so widening an entry brings them back on the next read.
    it('keeps a session covered by an entry that has no project', async () => {
      const rows = [
        makeSessionRow({
          url: 'https://tracked.example/',
          host: 'tracked.example',
          startedAt: new Date('2026-09-08T09:00:00.000Z'),
        }),
      ];
      const service = makeService({
        urlSessionsRepo: makeUrlSessionsRepo({
          find: jest.fn().mockResolvedValue(rows),
        }),
        timeEntriesService: makeTimeEntriesService([
          {
            id: 'te-1',
            projectId: null,
            startedAt: new Date('2026-09-08T08:00:00.000Z'),
            endedAt: new Date('2026-09-08T10:00:00.000Z'),
          },
        ]),
      });

      const day = await service.getDayGroupedByUrl(
        'org-1',
        'user-1',
        '2026-09-08',
      );

      expect(day.buckets).toHaveLength(1);
      expect(day.buckets[0].pages[0].projectId).toBeNull();
    });

    it('omits a session no entry covers', async () => {
      const rows = [
        makeSessionRow({
          url: 'https://tracked.example/',
          host: 'tracked.example',
          startedAt: new Date('2026-09-08T09:00:00.000Z'),
        }),
        makeSessionRow({
          url: 'https://untracked.example/',
          host: 'untracked.example',
          startedAt: new Date('2026-09-08T11:00:00.000Z'),
        }),
      ];
      const urlSessionsRepo = makeUrlSessionsRepo({
        find: jest.fn().mockResolvedValue(rows),
      });
      const coveringEntries: FakeCoveringEntry[] = [
        {
          id: 'te-1',
          projectId: 'project-1',
          startedAt: new Date('2026-09-08T08:00:00.000Z'),
          endedAt: new Date('2026-09-08T10:00:00.000Z'),
        },
      ];
      const service = makeService({
        urlSessionsRepo,
        timeEntriesService: makeTimeEntriesService(coveringEntries),
      });

      const day = await service.getDayGroupedByUrl(
        'org-1',
        'user-1',
        '2026-09-08',
      );

      expect(day.buckets).toHaveLength(1);
      expect(day.buckets[0].pages[0].url).toBe('https://tracked.example/');
    });

    it('rejects a malformed date', async () => {
      const service = makeService();

      await expect(
        service.getDayGroupedByUrl('org-1', 'user-1', 'not-a-date'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deleteByUrl', () => {
    it('deletes every session for that membership+url and records an audit log entry', async () => {
      const deleteFn = jest.fn().mockResolvedValue({ affected: 3 });
      const urlSessionsRepo = makeUrlSessionsRepo({ delete: deleteFn });
      const membershipsRepo = makeMembershipsRepo({
        // First lookup resolves the TARGET, second resolves the CALLER —
        // they must differ, since deleting your own activity is refused.
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 'target-membership' })
          .mockResolvedValueOnce({
            id: 'admin-membership',
            role: MembershipRole.ADMIN,
          }),
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

    it('refuses to let anyone delete their OWN activity, including an admin', async () => {
      // Tamper-resistance: tracked browsing is evidence recorded about a
      // person, not a claim they make, so nobody gets to quietly erase
      // their own — deliberately stricter than ADR-0007's Time entry rule,
      // where an admin may edit their own hours.
      const ownMembership = { id: 'm-admin', role: MembershipRole.ADMIN };
      const membershipsRepo = makeMembershipsRepo({
        findOne: jest.fn().mockResolvedValue(ownMembership),
      });
      const deleteFn = jest.fn().mockResolvedValue({ affected: 3 });
      const urlSessionsRepo = makeUrlSessionsRepo({ delete: deleteFn });
      const service = makeService({ membershipsRepo, urlSessionsRepo });

      await expect(
        service.deleteByUrl(
          'org-1',
          'admin-user',
          'm-admin',
          'https://example.com',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // And nothing was removed before the check.
      expect(deleteFn).not.toHaveBeenCalled();
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
