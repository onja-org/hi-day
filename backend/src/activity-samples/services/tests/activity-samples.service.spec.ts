import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivitySample } from '../../../database/entities/activity-sample.entity';
import { Membership } from '../../../database/entities/membership.entity';
import { ActivitySamplesService } from '../activity-samples.service';

describe('ActivitySamplesService', () => {
  function makeActivitySamplesRepo() {
    const save = jest.fn().mockResolvedValue(undefined);
    const repo = {
      create: jest.fn((data: unknown) => data),
      save,
    } as unknown as Repository<ActivitySample>;
    return { repo, save };
  }

  function makeMembershipsRepo(
    overrides: Partial<Repository<Membership>> = {},
  ) {
    return {
      findOne: jest.fn(),
      ...overrides,
    } as unknown as Repository<Membership>;
  }

  describe('recordBatch', () => {
    it('resolves the active membership and saves one row per sample', async () => {
      const findOne = jest.fn().mockResolvedValue({
        id: 'membership-1',
        userId: 'user-1',
        organisationId: 'org-1',
      });
      const { repo: activitySamplesRepo, save } = makeActivitySamplesRepo();
      const service = new ActivitySamplesService(
        activitySamplesRepo,
        makeMembershipsRepo({ findOne }),
      );

      await service.recordBatch('org-1', 'user-1', 'device-1', [
        {
          activePercentage: 42,
          periodStart: '2026-09-08T12:00:00.000Z',
          periodEnd: '2026-09-08T12:10:00.000Z',
        },
      ]);

      expect(save).toHaveBeenCalledWith([
        expect.objectContaining({
          organisationId: 'org-1',
          membershipId: 'membership-1',
          deviceId: 'device-1',
          activePercentage: 42,
          periodStart: new Date('2026-09-08T12:00:00.000Z'),
          periodEnd: new Date('2026-09-08T12:10:00.000Z'),
        }),
      ]);
    });

    it('throws when the caller has no active membership in the organisation', async () => {
      const service = new ActivitySamplesService(
        makeActivitySamplesRepo().repo,
        makeMembershipsRepo({ findOne: jest.fn().mockResolvedValue(null) }),
      );

      await expect(
        service.recordBatch('org-1', 'user-1', 'device-1', []),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
