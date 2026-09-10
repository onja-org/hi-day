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
import type { ScreenshotStorageService } from '../screenshot-storage.service';
import { ScreenshotsService } from '../screenshots.service';

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

  describe('requestUploadUrl', () => {
    it('builds a storage key namespaced by org and device, and returns a presigned PUT URL', async () => {
      const { storage, buildStorageKey } = makeStorage();
      const service = new ScreenshotsService(
        makeScreenshotsRepo().repo,
        makeMembershipsRepo(),
        makeOrganisationsService(),
        storage,
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
        },
      ]);
      expect(createViewUrl).toHaveBeenCalledWith(
        'screenshots/org-1/device-1/123-uuid.jpg',
      );
    });

    it('rejects a malformed date', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const service = new ScreenshotsService(
        makeScreenshotsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeOrganisationsService(),
        makeStorage().storage,
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
