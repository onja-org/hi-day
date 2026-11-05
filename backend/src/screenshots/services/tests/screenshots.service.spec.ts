import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { Screenshot } from '../../../database/entities/screenshot.entity';
import type { OrganisationsService } from '../../../organisations/services/organisations.service';
import type { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import type { ScreenshotStorageService } from '../screenshot-storage.service';
import { ScreenshotsService } from '../screenshots.service';

type FakeCoveringEntry = {
  id: string;
  projectId: string;
  startedAt: Date;
  endedAt: Date | null;
};

describe('ScreenshotsService', () => {
  function makeScreenshotsRepo(rows: Screenshot[] = []) {
    const save = jest.fn().mockResolvedValue(undefined);
    const find = jest.fn().mockResolvedValue(rows);
    const deleteFn = jest.fn().mockResolvedValue(undefined);
    const findOne = jest.fn().mockResolvedValue(rows[0] ?? null);
    const repo = {
      create: jest.fn((data: unknown) => data),
      save,
      find,
      findOne,
      delete: deleteFn,
    } as unknown as Repository<Screenshot>;
    return { repo, save, find, findOne, delete: deleteFn };
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn(),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  function makeOrganisationsService(
    overrides: Partial<OrganisationsService> = {},
  ) {
    return {
      getCaptureSettings: jest.fn().mockResolvedValue({
        windowTrackingEnabled: false,
        screenshotsEnabled: true,
        screenshotFrequencySeconds: 600,
        screenshotRetentionDays: 30,
      }),
      membersCanDeleteScreenshots: jest.fn().mockResolvedValue(false),
      ...overrides,
    } as unknown as OrganisationsService;
  }

  function makeStorage(overrides: Partial<ScreenshotStorageService> = {}) {
    const buildStorageKey = jest.fn(
      (organisationId: string, deviceId: string, capturedAt: Date) =>
        `screenshots/${organisationId}/${deviceId}/${capturedAt.getTime()}-uuid.jpg`,
    );
    const createUploadUrl = jest
      .fn()
      .mockResolvedValue('https://upload.example/put');
    const createViewUrl = jest
      .fn()
      .mockResolvedValue('https://view.example/get');
    const deleteObjects = jest.fn().mockResolvedValue(undefined);
    const storage = {
      buildStorageKey,
      createUploadUrl,
      createViewUrl,
      deleteObjects,
      ...overrides,
    } as unknown as ScreenshotStorageService;
    return {
      storage,
      buildStorageKey,
      createUploadUrl,
      createViewUrl,
      deleteObjects,
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

  describe('requestUploadUrl', () => {
    it('builds a storage key namespaced by org and device, and returns a presigned PUT URL', async () => {
      const { storage, buildStorageKey } = makeStorage();
      const service = new ScreenshotsService(
        makeScreenshotsRepo().repo,
        makeMembershipsRepo(),
        makeOrganisationsService(),
        storage,
        makeTimeEntriesService(),
      );

      const result = await service.requestUploadUrl(
        'org-1',
        'device-1',
        '2026-09-08T12:00:00.000Z',
      );

      expect(buildStorageKey).toHaveBeenCalledWith(
        'org-1',
        'device-1',
        new Date('2026-09-08T12:00:00.000Z'),
      );
      expect(result).toEqual({
        uploadUrl: 'https://upload.example/put',
        storageKey: `screenshots/org-1/device-1/${new Date('2026-09-08T12:00:00.000Z').getTime()}-uuid.jpg`,
      });
    });
  });

  describe('recordScreenshot', () => {
    it('rejects a storage key not issued to this device', async () => {
      const service = new ScreenshotsService(
        makeScreenshotsRepo().repo,
        makeMembershipsRepo(),
        makeOrganisationsService(),
        makeStorage().storage,
        makeTimeEntriesService(),
      );

      await expect(
        service.recordScreenshot(
          'org-1',
          'user-1',
          'device-1',
          'screenshots/org-1/some-other-device/123-uuid.jpg',
          '2026-09-08T12:00:00.000Z',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the caller has no active membership in the organisation', async () => {
      const service = new ScreenshotsService(
        makeScreenshotsRepo().repo,
        makeMembershipsRepo({ findOne: jest.fn().mockResolvedValue(null) }),
        makeOrganisationsService(),
        makeStorage().storage,
        makeTimeEntriesService(),
      );

      await expect(
        service.recordScreenshot(
          'org-1',
          'user-1',
          'device-1',
          'screenshots/org-1/device-1/123-uuid.jpg',
          '2026-09-08T12:00:00.000Z',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('saves a row with keptUntil computed from the org’s retention setting', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { repo, save } = makeScreenshotsRepo();
      const service = new ScreenshotsService(
        repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService({
          getCaptureSettings: jest.fn().mockResolvedValue({
            windowTrackingEnabled: false,
            screenshotsEnabled: true,
            screenshotFrequencySeconds: 600,
            screenshotRetentionDays: 30,
          }),
        }),
        makeStorage().storage,
        makeTimeEntriesService(),
      );

      await service.recordScreenshot(
        'org-1',
        'user-1',
        'device-1',
        'screenshots/org-1/device-1/123-uuid.jpg',
        '2026-01-01T00:00:00.000Z',
      );

      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: 'org-1',
          membershipId: 'membership-1',
          deviceId: 'device-1',
          storageKey: 'screenshots/org-1/device-1/123-uuid.jpg',
          capturedAt: new Date('2026-01-01T00:00:00.000Z'),
          keptUntil: new Date('2026-01-31T00:00:00.000Z'),
        }),
      );
    });
  });

  describe('getMyScreenshots', () => {
    it("resolves the caller's own membership and returns presigned view URLs", async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const row = {
        id: 'screenshot-1',
        capturedAt: new Date('2026-09-08T12:00:00.000Z'),
        storageKey: 'screenshots/org-1/device-1/123-uuid.jpg',
      } as Screenshot;
      const { repo } = makeScreenshotsRepo([row]);
      const { storage, createViewUrl } = makeStorage();
      const service = new ScreenshotsService(
        repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        storage,
        makeTimeEntriesService(),
      );

      const result = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
      );

      expect(result).toEqual({
        items: [
          {
            id: 'screenshot-1',
            capturedAt: '2026-09-08T12:00:00.000Z',
            url: 'https://view.example/get',
            projectId: 'project-day',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 8,
      });
      expect(createViewUrl).toHaveBeenCalledWith(
        'screenshots/org-1/device-1/123-uuid.jpg',
      );
    });

    it('attributes a screenshot to whichever project covered its capturedAt', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const row = {
        id: 'screenshot-1',
        capturedAt: new Date('2026-09-08T12:00:00.000Z'),
        storageKey: 'screenshots/org-1/device-1/123-uuid.jpg',
      } as Screenshot;
      const { repo } = makeScreenshotsRepo([row]);
      const coveringEntries: FakeCoveringEntry[] = [
        {
          id: 'te-1',
          projectId: 'project-1',
          startedAt: new Date('2026-09-08T11:00:00.000Z'),
          endedAt: new Date('2026-09-08T13:00:00.000Z'),
        },
      ];
      const service = new ScreenshotsService(
        repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        makeStorage().storage,
        makeTimeEntriesService(coveringEntries),
      );

      const result = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
      );

      expect(result.items[0].projectId).toBe('project-1');
    });

    it('filters to a given project, excluding screenshots outside its covering entries', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const covered = {
        id: 'screenshot-1',
        capturedAt: new Date('2026-09-08T12:00:00.000Z'),
        storageKey: 'screenshots/org-1/device-1/a.jpg',
      } as Screenshot;
      const uncovered = {
        id: 'screenshot-2',
        capturedAt: new Date('2026-09-08T15:00:00.000Z'),
        storageKey: 'screenshots/org-1/device-1/b.jpg',
      } as Screenshot;
      const { repo } = makeScreenshotsRepo([covered, uncovered]);
      const coveringEntries: FakeCoveringEntry[] = [
        {
          id: 'te-1',
          projectId: 'project-1',
          startedAt: new Date('2026-09-08T11:00:00.000Z'),
          endedAt: new Date('2026-09-08T13:00:00.000Z'),
        },
      ];
      const service = new ScreenshotsService(
        repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        makeStorage().storage,
        makeTimeEntriesService(coveringEntries),
      );

      const result = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
        {
          projectId: 'project-1',
        },
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('screenshot-1');
      expect(result.total).toBe(1);
    });

    // Screenshots outside every entry are dropped rather than labelled
    // "untracked", so widening an entry brings them back on the next read.
    it('omits a screenshot no entry covers', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const covered = {
        id: 'screenshot-1',
        capturedAt: new Date('2026-09-08T12:00:00.000Z'),
        storageKey: 'screenshots/org-1/device-1/a.jpg',
      } as Screenshot;
      const uncovered = {
        id: 'screenshot-2',
        capturedAt: new Date('2026-09-08T15:00:00.000Z'),
        storageKey: 'screenshots/org-1/device-1/b.jpg',
      } as Screenshot;
      const { repo } = makeScreenshotsRepo([covered, uncovered]);
      const coveringEntries: FakeCoveringEntry[] = [
        {
          id: 'te-1',
          projectId: 'project-1',
          startedAt: new Date('2026-09-08T11:00:00.000Z'),
          endedAt: new Date('2026-09-08T13:00:00.000Z'),
        },
      ];
      const service = new ScreenshotsService(
        repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        makeStorage().storage,
        makeTimeEntriesService(coveringEntries),
      );

      const result = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('screenshot-1');
      expect(result.total).toBe(1);
    });

    it('rejects a malformed date', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const service = new ScreenshotsService(
        makeScreenshotsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        makeStorage().storage,
        makeTimeEntriesService(),
      );

      await expect(
        service.getMyScreenshots('org-1', 'user-1', 'not-a-date'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('pagination', () => {
    /** `count` rows a minute apart from 09:00, all inside ALL_DAY. */
    function rowsFrom(count: number): Screenshot[] {
      return Array.from(
        { length: count },
        (_, i) =>
          ({
            id: `screenshot-${i + 1}`,
            capturedAt: new Date(Date.UTC(2026, 8, 8, 9, i)),
            storageKey: `screenshots/org-1/device-1/${i + 1}.jpg`,
          }) as Screenshot,
      );
    }

    function makeService(
      rows: Screenshot[],
      coveringEntries: FakeCoveringEntry[] = [ALL_DAY],
    ) {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const screenshotsRepo = makeScreenshotsRepo(rows);
      const storageMocks = makeStorage();
      const service = new ScreenshotsService(
        screenshotsRepo.repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        storageMocks.storage,
        makeTimeEntriesService(coveringEntries),
      );
      return { service, find: screenshotsRepo.find, ...storageMocks };
    }

    const ids = (page: { items: { id: string }[] }) =>
      page.items.map((item) => item.id);

    it('serves the first 8 by default, but counts the whole day', async () => {
      const { service } = makeService(rowsFrom(20));

      const result = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
      );

      expect(ids(result)).toEqual([
        'screenshot-1',
        'screenshot-2',
        'screenshot-3',
        'screenshot-4',
        'screenshot-5',
        'screenshot-6',
        'screenshot-7',
        'screenshot-8',
      ]);
      expect(result.total).toBe(20);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(8);
    });

    it('serves the requested page, with a short last page', async () => {
      const { service } = makeService(rowsFrom(20));

      const second = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
        {},
        { page: 2 },
      );
      const third = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
        {},
        { page: 3 },
      );

      expect(ids(second)[0]).toBe('screenshot-9');
      expect(second.items).toHaveLength(8);
      expect(ids(third)).toEqual([
        'screenshot-17',
        'screenshot-18',
        'screenshot-19',
        'screenshot-20',
      ]);
    });

    // The point of paging: a day of captures costs eight signatures, not
    // one per screenshot.
    it('signs a view URL only for the page it serves', async () => {
      const { service, createViewUrl } = makeService(rowsFrom(20));

      await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
        {},
        { page: 3 },
      );

      expect(createViewUrl).toHaveBeenCalledTimes(4);
      expect(createViewUrl).toHaveBeenCalledWith(
        'screenshots/org-1/device-1/17.jpg',
      );
    });

    // Deleting everything on the last page leaves the gallery asking for
    // a page that no longer exists — it gets the new last page instead
    // of an empty grid with screenshots still on earlier pages.
    it('serves the last page when asked for one past the end', async () => {
      const { service } = makeService(rowsFrom(10));

      const result = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
        {},
        { page: 5 },
      );

      expect(result.page).toBe(2);
      expect(ids(result)).toEqual(['screenshot-9', 'screenshot-10']);
    });

    it('serves page 1 of nothing for an empty day', async () => {
      const { service } = makeService([]);

      const result = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
        {},
        { page: 3 },
      );

      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 8 });
    });

    it('honours a custom page size', async () => {
      const { service } = makeService(rowsFrom(10));

      const result = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
        {},
        { page: 2, pageSize: 3 },
      );

      expect(ids(result)).toEqual([
        'screenshot-4',
        'screenshot-5',
        'screenshot-6',
      ]);
      expect(result.pageSize).toBe(3);
    });

    // Pages are cut after the coverage and project filters, so a page is
    // never short just because hidden screenshots fell inside it, and the
    // total matches what the gallery can actually show.
    it('pages and counts only what the filters let through', async () => {
      const rows = rowsFrom(20);
      const firstTenMinutes: FakeCoveringEntry = {
        id: 'te-1',
        projectId: 'project-1',
        startedAt: new Date(Date.UTC(2026, 8, 8, 9, 0)),
        endedAt: new Date(Date.UTC(2026, 8, 8, 9, 9, 30)),
      };
      const rest: FakeCoveringEntry = {
        id: 'te-2',
        projectId: 'project-2',
        startedAt: new Date(Date.UTC(2026, 8, 8, 9, 9, 30)),
        endedAt: new Date(Date.UTC(2026, 8, 8, 9, 15, 30)),
      };
      const { service } = makeService(rows, [firstTenMinutes, rest]);

      const result = await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
        { projectId: 'project-2' },
        { page: 1 },
      );

      // 09:10–09:15 is project-2; 09:16 onwards nothing covers.
      expect(result.total).toBe(6);
      expect(ids(result)).toEqual([
        'screenshot-11',
        'screenshot-12',
        'screenshot-13',
        'screenshot-14',
        'screenshot-15',
        'screenshot-16',
      ]);
    });

    it('asks the database for oldest first by default, newest first on request', async () => {
      const { service, find } = makeService([]);

      await service.getMyScreenshots('org-1', 'user-1', '2026-09-08');
      await service.getMyScreenshots(
        'org-1',
        'user-1',
        '2026-09-08',
        {},
        { newestFirst: true },
      );

      expect(find).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ order: { capturedAt: 'ASC' } }),
      );
      expect(find).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ order: { capturedAt: 'DESC' } }),
      );
    });

    it('loads only the columns paging needs, not whole rows', async () => {
      const { service, find } = makeService([]);

      await service.getMyScreenshots('org-1', 'user-1', '2026-09-08');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, capturedAt: true, storageKey: true },
        }),
      );
    });
  });

  describe('getScreenshotsForMembership', () => {
    it('allows an admin to view any membership', async () => {
      const findOne = jest
        .fn()
        .mockResolvedValueOnce({
          id: 'caller-1',
          role: MembershipRole.ADMIN,
          teamMemberships: [],
        })
        .mockResolvedValueOnce({
          id: 'target-1',
          role: MembershipRole.MEMBER,
          teamMemberships: [],
        });
      const service = new ScreenshotsService(
        makeScreenshotsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        makeStorage().storage,
        makeTimeEntriesService(),
      );

      await expect(
        service.getScreenshotsForMembership(
          'org-1',
          'admin-user',
          'target-1',
          '2026-09-08',
        ),
      ).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 8 });
    });

    it("rejects a manager viewing someone outside their team's scope", async () => {
      const findOne = jest
        .fn()
        .mockResolvedValueOnce({
          id: 'caller-1',
          role: MembershipRole.MANAGER,
          teamMemberships: [],
        })
        .mockResolvedValueOnce({
          id: 'target-1',
          role: MembershipRole.MEMBER,
          teamMemberships: [{ teamId: 'team-1', isManager: false }],
        });
      const service = new ScreenshotsService(
        makeScreenshotsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        makeStorage().storage,
        makeTimeEntriesService(),
      );

      await expect(
        service.getScreenshotsForMembership(
          'org-1',
          'manager-user',
          'target-1',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when either membership cannot be found', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = new ScreenshotsService(
        makeScreenshotsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        makeStorage().storage,
        makeTimeEntriesService(),
      );

      await expect(
        service.getScreenshotsForMembership('org-1', 'user-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteScreenshot', () => {
    const OWNED = {
      id: 'screenshot-1',
      membershipId: 'membership-owner',
      storageKey: 'screenshots/org-1/device-1/a.jpg',
    } as Screenshot;

    function makeService(
      caller: Partial<Membership>,
      organisationAllows: boolean,
      row: Screenshot | null = OWNED,
    ) {
      const { repo, delete: deleteFn } = makeScreenshotsRepo(row ? [row] : []);
      const { storage, deleteObjects } = makeStorage();
      const service = new ScreenshotsService(
        repo,
        makeMembershipsRepo({ findOne: jest.fn().mockResolvedValue(caller) }),
        makeOrganisationsService({
          membersCanDeleteScreenshots: jest
            .fn()
            .mockResolvedValue(organisationAllows),
        }),
        storage,
        makeTimeEntriesService(),
      );
      return { service, delete: deleteFn, deleteObjects };
    }

    it("lets an admin delete anyone's, whatever the organisation allows", async () => {
      const {
        service,
        delete: deleteFn,
        deleteObjects,
      } = makeService(
        { id: 'membership-admin', role: MembershipRole.ADMIN },
        false,
      );

      await service.deleteScreenshot('org-1', 'user-1', 'screenshot-1');

      expect(deleteFn).toHaveBeenCalledWith({ id: 'screenshot-1' });
      expect(deleteObjects).toHaveBeenCalledWith([OWNED.storageKey]);
    });

    it('lets a member delete their own once the organisation allows it', async () => {
      const { service, delete: deleteFn } = makeService(
        {
          id: 'membership-owner',
          role: MembershipRole.MEMBER,
          canDeleteScreenshots: null,
        },
        true,
      );

      await service.deleteScreenshot('org-1', 'user-1', 'screenshot-1');

      expect(deleteFn).toHaveBeenCalled();
    });

    it('refuses a member their own while the organisation does not allow it', async () => {
      const { service, delete: deleteFn } = makeService(
        {
          id: 'membership-owner',
          role: MembershipRole.MEMBER,
          canDeleteScreenshots: null,
        },
        false,
      );

      await expect(
        service.deleteScreenshot('org-1', 'user-1', 'screenshot-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(deleteFn).not.toHaveBeenCalled();
    });

    it("refuses someone else's screenshot even where deleting is allowed", async () => {
      const { service, delete: deleteFn } = makeService(
        {
          id: 'membership-other',
          role: MembershipRole.MEMBER,
          canDeleteScreenshots: true,
        },
        true,
      );

      await expect(
        service.deleteScreenshot('org-1', 'user-1', 'screenshot-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(deleteFn).not.toHaveBeenCalled();
    });

    it("lets a member's own override beat an organisation that forbids it", async () => {
      const { service, delete: deleteFn } = makeService(
        {
          id: 'membership-owner',
          role: MembershipRole.MEMBER,
          canDeleteScreenshots: true,
        },
        false,
      );

      await service.deleteScreenshot('org-1', 'user-1', 'screenshot-1');

      expect(deleteFn).toHaveBeenCalled();
    });

    it('throws when the screenshot is not in this organisation', async () => {
      const { service } = makeService(
        { id: 'membership-admin', role: MembershipRole.ADMIN },
        true,
        null,
      );

      await expect(
        service.deleteScreenshot('org-1', 'user-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteExpired', () => {
    it('does nothing when there are no expired screenshots', async () => {
      const { repo } = makeScreenshotsRepo([]);
      const { storage, deleteObjects } = makeStorage();
      const service = new ScreenshotsService(
        repo,
        makeMembershipsRepo(),
        makeOrganisationsService(),
        storage,
        makeTimeEntriesService(),
      );

      await service.deleteExpired();

      expect(deleteObjects).not.toHaveBeenCalled();
    });

    it('deletes the storage objects and the DB rows for expired screenshots', async () => {
      const expired = [
        { id: 'screenshot-1', storageKey: 'screenshots/org-1/device-1/a.jpg' },
        { id: 'screenshot-2', storageKey: 'screenshots/org-1/device-1/b.jpg' },
      ] as Screenshot[];
      const { repo, delete: deleteFn } = makeScreenshotsRepo(expired);
      const { storage, deleteObjects } = makeStorage();
      const service = new ScreenshotsService(
        repo,
        makeMembershipsRepo(),
        makeOrganisationsService(),
        storage,
        makeTimeEntriesService(),
      );

      await service.deleteExpired();

      expect(deleteObjects).toHaveBeenCalledWith([
        'screenshots/org-1/device-1/a.jpg',
        'screenshots/org-1/device-1/b.jpg',
      ]);
      expect(deleteFn).toHaveBeenCalled();
    });
  });
});
