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
    const repo = {
      create: jest.fn((data: unknown) => data),
      save,
      find,
      delete: deleteFn,
    } as unknown as Repository<Screenshot>;
    return { repo, save, find, delete: deleteFn };
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

      expect(result).toEqual([
        {
          id: 'screenshot-1',
          capturedAt: '2026-09-08T12:00:00.000Z',
          url: 'https://view.example/get',
          projectId: 'project-day',
        },
      ]);
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

      expect(result[0].projectId).toBe('project-1');
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

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('screenshot-1');
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

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('screenshot-1');
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
      ).resolves.toEqual([]);
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
