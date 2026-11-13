import type { Repository } from 'typeorm';
import type { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import type { AppUrlTracking } from '../../../organisations/app-url-tracking';
import type { OrganisationsService } from '../../../organisations/services/organisations.service';
import type { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import type { WorkClassificationService } from '../../../work-classification/services/work-classification.service';
import type { WorkTimeSplit } from '../../../work-classification/work-classification.util';
import { InsightsService } from '../insights.service';

const SPLIT: WorkTimeSplit = {
  coreSeconds: 600,
  nonCoreSeconds: 300,
  unclassifiedSeconds: 100,
};

/** An admin looking at their own Performance — the simplest caller who can see it. */
function makeService({
  organisationTracking = 'apps',
  memberTracking = null as AppUrlTracking | null,
  mayViewOwnActivity = true,
  split = SPLIT,
} = {}) {
  const me = {
    id: 'membership-1',
    userId: 'user-1',
    organisationId: 'org-1',
    role: MembershipRole.ADMIN,
    appUrlTracking: memberTracking,
    activityTrackingEnabled: null,
    expectedWorkDays: null,
    teamMemberships: [],
  } as unknown as Membership;

  const memberships = {
    findOne: jest.fn().mockResolvedValue(me),
    find: jest.fn().mockResolvedValue([me]),
  } as unknown as Repository<Membership>;
  const organisationsService = {
    getInsightsDefaults: jest.fn().mockResolvedValue({
      timezone: 'UTC',
      hoursPerDay: 8,
      expectedWorkDays: [1, 2, 3, 4, 5],
      activityTrackingEnabled: true,
      appUrlTracking: organisationTracking,
    }),
    mayViewOwnActivity: jest.fn().mockResolvedValue(mayViewOwnActivity),
    getCaptureSettings: jest
      .fn()
      .mockResolvedValue({ activityTrackingEnabled: true }),
  } as unknown as OrganisationsService;
  const timeEntriesService = {
    timelineWindows: jest
      .fn()
      .mockResolvedValue(
        new Map([
          [me.id, { entries: [], pausesByEntry: new Map(), samples: [] }],
        ]),
      ),
  } as unknown as TimeEntriesService;
  const splitForMember = jest.fn().mockResolvedValue(split);
  const workClassificationService = {
    splitForMember,
  } as unknown as WorkClassificationService;

  const service = new InsightsService(
    memberships,
    organisationsService,
    timeEntriesService,
    workClassificationService,
  );
  const workTime = async () =>
    (
      await service.getPerformance(
        'org-1',
        'user-1',
        undefined,
        '2026-11-02',
        '2026-11-08',
      )
    ).workTimeClassification;

  return { workTime, splitForMember };
}

describe('InsightsService — Performance work time classification', () => {
  it('splits tracked app time into core, non-core and unclassified', async () => {
    const { workTime, splitForMember } = makeService();

    await expect(workTime()).resolves.toEqual({
      status: 'available',
      ...SPLIT,
    });
    // The whole range, on the organisation's calendar.
    expect(splitForMember).toHaveBeenCalledWith(
      'org-1',
      'membership-1',
      new Date('2026-11-02T00:00:00.000Z'),
      new Date('2026-11-09T00:00:00.000Z'),
    );
  });

  it("is not available when the member's own tracking is off", async () => {
    const { workTime, splitForMember } = makeService({ memberTracking: 'off' });

    await expect(workTime()).resolves.toEqual({ status: 'not_available' });
    expect(splitForMember).not.toHaveBeenCalled();
  });

  it("is not available when it's off for the organisation and the member has no override", async () => {
    const { workTime } = makeService({ organisationTracking: 'off' });

    await expect(workTime()).resolves.toEqual({ status: 'not_available' });
  });

  it("follows the member's override over the organisation's off", async () => {
    const { workTime } = makeService({
      organisationTracking: 'off',
      memberTracking: 'apps_urls',
    });

    await expect(workTime()).resolves.toMatchObject({ status: 'available' });
  });

  it('is not available to a member who may not see their own activity', async () => {
    const { workTime } = makeService({ mayViewOwnActivity: false });

    await expect(workTime()).resolves.toEqual({ status: 'not_available' });
  });

  it('has no data when no app time was tracked in the range', async () => {
    const { workTime } = makeService({
      split: { coreSeconds: 0, nonCoreSeconds: 0, unclassifiedSeconds: 0 },
    });

    await expect(workTime()).resolves.toEqual({ status: 'no_data' });
  });
});
