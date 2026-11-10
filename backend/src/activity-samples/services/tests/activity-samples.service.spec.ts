import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivitySample } from '../../../database/entities/activity-sample.entity';
import { Membership } from '../../../database/entities/membership.entity';
import { OrganisationsService } from '../../../organisations/services/organisations.service';
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

  function makeMembershipsRepo(membership: unknown) {
    return {
      findOne: jest.fn().mockResolvedValue(membership),
    } as unknown as Repository<Membership>;
  }

  function makeOrganisationsService(activityTrackingEnabled = true) {
    return {
      getCaptureSettings: jest
        .fn()
        .mockResolvedValue({ activityTrackingEnabled }),
    } as unknown as OrganisationsService;
  }

  const SAMPLE = {
    activePercentage: 75,
    periodStart: '2026-09-08T09:00:00.000Z',
    periodEnd: '2026-09-08T09:10:00.000Z',
  };

  it('stores a batch against the signed-in membership and the sending device', async () => {
    const { repo, save } = makeActivitySamplesRepo();
    const service = new ActivitySamplesService(
      repo,
      makeMembershipsRepo({ id: 'membership-1' }),
      makeOrganisationsService(),
    );

    await service.recordBatch('org-1', 'user-1', 'device-1', [SAMPLE]);

    expect(save).toHaveBeenCalledWith([
      {
        organisationId: 'org-1',
        membershipId: 'membership-1',
        deviceId: 'device-1',
        activePercentage: 75,
        periodStart: new Date(SAMPLE.periodStart),
        periodEnd: new Date(SAMPLE.periodEnd),
      },
    ]);
  });

  // A shared machine's Device row reflects whoever signed in last, so the
  // membership has to be resolved from the request, never from the Device.
  it('rejects a device whose signed-in user has no active membership', async () => {
    const { repo, save } = makeActivitySamplesRepo();
    const service = new ActivitySamplesService(
      repo,
      makeMembershipsRepo(null),
      makeOrganisationsService(),
    );

    await expect(
      service.recordBatch('org-1', 'user-1', 'device-1', [SAMPLE]),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(save).not.toHaveBeenCalled();
  });

  it('saves every sample in one write rather than one at a time', async () => {
    const { repo, save } = makeActivitySamplesRepo();
    const service = new ActivitySamplesService(
      repo,
      makeMembershipsRepo({ id: 'membership-1' }),
      makeOrganisationsService(),
    );

    await service.recordBatch('org-1', 'user-1', 'device-1', [SAMPLE, SAMPLE]);

    expect(save).toHaveBeenCalledTimes(1);
    expect((save.mock.calls[0] as unknown[][])[0]).toHaveLength(2);
  });

  // The agent stops sampling when Record activity goes off, but an offline
  // queue can still arrive with samples taken before it did.
  it('drops the batch when Record activity is off for the member', async () => {
    const { repo, save } = makeActivitySamplesRepo();
    const service = new ActivitySamplesService(
      repo,
      makeMembershipsRepo({ id: 'membership-1' }),
      makeOrganisationsService(false),
    );

    await service.recordBatch('org-1', 'user-1', 'device-1', [SAMPLE]);

    expect(save).not.toHaveBeenCalled();
  });
});
