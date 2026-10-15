import type { CaptureSettings } from '../../../organisations/capture-settings';
import { OrganisationsService } from '../../../organisations/services/organisations.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AppEvent } from '../../../database/entities/app-event.entity';
import { AppEventTitleUnavailableReason } from '../../../database/entities/app-event-title-unavailable-reason.enum';
import { Membership } from '../../../database/entities/membership.entity';
import { MembershipRole } from '../../../database/entities/membership-role.enum';
import { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import { AppEventsService } from '../app-events.service';

type FakeAppEvent = { appName: string; sampledAt: Date };
type FakeCoveringEntry = {
  id: string;
  projectId: string | null;
  startedAt: Date;
  endedAt: Date | null;
};

describe('AppEventsService', () => {
  function makeAppEventsRepo(rows: FakeAppEvent[] = []) {
    const save = jest.fn().mockResolvedValue(undefined);
    const repo = {
      create: jest.fn((data: unknown) => data),
      save,
      find: jest.fn().mockResolvedValue(rows),
    } as unknown as Repository<AppEvent>;
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

  describe('recordBatch', () => {
    it('resolves the active membership and saves one row per event', async () => {
      const findOne = jest.fn().mockResolvedValue({
        id: 'membership-1',
        userId: 'user-1',
        organisationId: 'org-1',
      });
      const { repo: appEventsRepo, save } = makeAppEventsRepo();
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      await service.recordBatch('org-1', 'user-1', 'device-1', [
        {
          appName: 'Google Chrome',
          title: 'Gmail',
          titleUnavailableReason: undefined,
          sampledAt: '2026-09-08T12:00:00.000Z',
        },
        {
          appName: 'Terminal',
          title: undefined,
          titleUnavailableReason: AppEventTitleUnavailableReason.HIDDEN_BY_APP,
          sampledAt: '2026-09-08T12:00:05.000Z',
        },
      ]);

      expect(save).toHaveBeenCalledWith([
        expect.objectContaining({
          organisationId: 'org-1',
          membershipId: 'membership-1',
          deviceId: 'device-1',
          appName: 'Google Chrome',
          title: 'Gmail',
          titleUnavailableReason: null,
        }),
        expect.objectContaining({
          organisationId: 'org-1',
          membershipId: 'membership-1',
          deviceId: 'device-1',
          appName: 'Terminal',
          title: null,
          titleUnavailableReason: AppEventTitleUnavailableReason.HIDDEN_BY_APP,
        }),
      ]);
    });

    it('stores the event without its title when window titles are off', async () => {
      const { repo: appEventsRepo, save } = makeAppEventsRepo();
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({ id: 'membership-1' }),
        }),
        makeTimeEntriesService(),
        makeOrganisationsService({ windowTrackingEnabled: false }),
      );

      await service.recordBatch('org-1', 'user-1', 'device-1', [
        {
          appName: 'Firefox',
          title: 'Secret document',
          sampledAt: new Date().toISOString(),
        },
      ]);

      expect(save).toHaveBeenCalledWith([
        expect.objectContaining({ appName: 'Firefox', title: null }),
      ]);
    });

    it('drops the batch when the organisation has app tracking off', async () => {
      const { repo: appEventsRepo, save } = makeAppEventsRepo();
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({
          findOne: jest.fn().mockResolvedValue({ id: 'membership-1' }),
        }),
        makeTimeEntriesService(),
        makeOrganisationsService({ appUrlTracking: 'off' }),
      );

      await service.recordBatch('org-1', 'user-1', 'device-1', [
        { appName: 'Firefox', sampledAt: new Date().toISOString() },
      ]);

      expect(save).not.toHaveBeenCalled();
    });

    it('throws when the caller has no active membership in the organisation', async () => {
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne: jest.fn().mockResolvedValue(null) }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      await expect(
        service.recordBatch('org-1', 'user-1', 'device-1', []),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getMyDay', () => {
    it('sums seconds per app (5s per sample) and buckets by hour', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { repo: appEventsRepo } = makeAppEventsRepo([
        {
          appName: 'Google Chrome',
          sampledAt: new Date('2026-09-08T09:00:00.000Z'),
        },
        {
          appName: 'Google Chrome',
          sampledAt: new Date('2026-09-08T09:00:05.000Z'),
        },
        { appName: 'Slack', sampledAt: new Date('2026-09-08T10:00:00.000Z') },
      ]);
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      const day = await service.getMyDay('org-1', 'user-1', '2026-09-08');

      expect(day).toEqual({
        date: '2026-09-08',
        totalSecondsSpent: 15,
        buckets: [
          {
            hourStart: '2026-09-08T09:00:00.000Z',
            items: [
              {
                projectId: 'project-day',
                appName: 'Google Chrome',
                secondsSpent: 10,
                sessionCount: 1,
              },
            ],
          },
          {
            hourStart: '2026-09-08T10:00:00.000Z',
            items: [
              {
                projectId: 'project-day',
                appName: 'Slack',
                secondsSpent: 5,
                sessionCount: 1,
              },
            ],
          },
        ],
      });
    });

    it('splits sessions on the A A A B A A pattern, not on time gaps', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const base = new Date('2026-09-08T09:00:00.000Z').getTime();
      const at = (offsetSeconds: number) =>
        new Date(base + offsetSeconds * 1000);
      const { repo: appEventsRepo } = makeAppEventsRepo([
        { appName: 'A', sampledAt: at(0) },
        { appName: 'A', sampledAt: at(5) },
        { appName: 'A', sampledAt: at(10) },
        { appName: 'B', sampledAt: at(15) },
        { appName: 'A', sampledAt: at(20) },
        { appName: 'A', sampledAt: at(25) },
      ]);
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      const day = await service.getMyDay('org-1', 'user-1', '2026-09-08');

      const items = day.buckets[0].items;
      const appA = items.find((item) => item.appName === 'A')!;
      const appB = items.find((item) => item.appName === 'B')!;
      expect(appA.sessionCount).toBe(2);
      expect(appA.secondsSpent).toBe(25); // 5 samples * 5s
      expect(appB.sessionCount).toBe(1);
      expect(appB.secondsSpent).toBe(5);
    });

    // Samples outside every entry are dropped, not labelled "untracked":
    // shortening an entry hides its samples and widening it back shows them
    // again, since coverage is recomputed on every read.
    it('attributes a sample to the project covering it, and omits uncovered ones', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { repo: appEventsRepo } = makeAppEventsRepo([
        { appName: 'Chrome', sampledAt: new Date('2026-09-08T09:00:00.000Z') },
        { appName: 'Chrome', sampledAt: new Date('2026-09-08T11:00:00.000Z') },
      ]);
      const coveringEntries: FakeCoveringEntry[] = [
        {
          id: 'te-1',
          projectId: 'project-1',
          startedAt: new Date('2026-09-08T08:00:00.000Z'),
          endedAt: new Date('2026-09-08T10:00:00.000Z'),
        },
      ];
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(coveringEntries),
        makeOrganisationsService(),
      );

      const day = await service.getMyDay('org-1', 'user-1', '2026-09-08');

      const covered = day.buckets.find(
        (b) => b.hourStart === '2026-09-08T09:00:00.000Z',
      )!;
      expect(covered.items[0].projectId).toBe('project-1');
      expect(
        day.buckets.find((b) => b.hourStart === '2026-09-08T11:00:00.000Z'),
      ).toBeUndefined();
      expect(day.totalSecondsSpent).toBe(5);
    });

    // Covered is not the same as having a Project: an Organisation with
    // Projects off tracks on entries that have none, and their samples must
    // still show.
    it('keeps a sample covered by an entry that has no project', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { repo: appEventsRepo } = makeAppEventsRepo([
        { appName: 'Chrome', sampledAt: new Date('2026-09-08T09:00:00.000Z') },
        { appName: 'Chrome', sampledAt: new Date('2026-09-08T11:00:00.000Z') },
      ]);
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService([
          {
            id: 'te-1',
            projectId: null,
            startedAt: new Date('2026-09-08T08:00:00.000Z'),
            endedAt: new Date('2026-09-08T10:00:00.000Z'),
          },
        ]),
        makeOrganisationsService(),
      );

      const day = await service.getMyDay('org-1', 'user-1', '2026-09-08');

      const covered = day.buckets.find(
        (b) => b.hourStart === '2026-09-08T09:00:00.000Z',
      )!;
      expect(covered.items[0].projectId).toBeNull();
      expect(day.totalSecondsSpent).toBe(5);
    });

    it('splits a session spanning two hours: duration in both, count once in the start hour', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { repo: appEventsRepo } = makeAppEventsRepo([
        { appName: 'Chrome', sampledAt: new Date('2026-09-08T09:59:55.000Z') },
        { appName: 'Chrome', sampledAt: new Date('2026-09-08T10:00:00.000Z') },
      ]);
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      const day = await service.getMyDay('org-1', 'user-1', '2026-09-08');

      const hour9 = day.buckets.find(
        (b) => b.hourStart === '2026-09-08T09:00:00.000Z',
      )!;
      const hour10 = day.buckets.find(
        (b) => b.hourStart === '2026-09-08T10:00:00.000Z',
      )!;
      expect(hour9.items[0]).toEqual({
        projectId: 'project-day',
        appName: 'Chrome',
        secondsSpent: 5,
        sessionCount: 1,
      });
      expect(hour10.items[0]).toEqual({
        projectId: 'project-day',
        appName: 'Chrome',
        secondsSpent: 5,
        sessionCount: 0,
      });
      expect(day.totalSecondsSpent).toBe(10);
    });

    it('only includes hours with at least one sample', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { repo: appEventsRepo } = makeAppEventsRepo([
        { appName: 'Chrome', sampledAt: new Date('2026-09-08T14:00:00.000Z') },
      ]);
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      const day = await service.getMyDay('org-1', 'user-1', '2026-09-08');

      expect(day.buckets).toHaveLength(1);
    });

    it('filters items to one project when projectId is given', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { repo: appEventsRepo } = makeAppEventsRepo([
        { appName: 'Chrome', sampledAt: new Date('2026-09-08T09:00:00.000Z') },
        { appName: 'Slack', sampledAt: new Date('2026-09-08T09:00:05.000Z') },
      ]);
      const coveringEntries: FakeCoveringEntry[] = [
        {
          id: 'te-1',
          projectId: 'project-1',
          startedAt: new Date('2026-09-08T09:00:00.000Z'),
          endedAt: new Date('2026-09-08T09:00:01.000Z'),
        },
      ];
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(coveringEntries),
        makeOrganisationsService(),
      );

      const day = await service.getMyDay('org-1', 'user-1', '2026-09-08', {
        projectId: 'project-1',
      });

      expect(day.buckets).toHaveLength(1);
      expect(day.buckets[0].items).toEqual([
        {
          projectId: 'project-1',
          appName: 'Chrome',
          secondsSpent: 5,
          sessionCount: 1,
        },
      ]);
    });

    it('returns nothing for a day no entry covers at all', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { repo: appEventsRepo } = makeAppEventsRepo([
        { appName: 'Chrome', sampledAt: new Date('2026-09-08T09:00:00.000Z') },
        { appName: 'Slack', sampledAt: new Date('2026-09-08T09:00:05.000Z') },
      ]);
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService([]),
        makeOrganisationsService(),
      );

      const day = await service.getMyDay('org-1', 'user-1', '2026-09-08');

      expect(day.buckets).toEqual([]);
      expect(day.totalSecondsSpent).toBe(0);
    });

    it('defaults to today when no date is given', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      const day = await service.getMyDay('org-1', 'user-1', undefined);

      expect(day.date).toBe(new Date().toISOString().slice(0, 10));
    });

    it('rejects a malformed date', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      await expect(
        service.getMyDay('org-1', 'user-1', 'not-a-date'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getDayForMembership', () => {
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
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      await expect(
        service.getDayForMembership(
          'org-1',
          'admin-user',
          'target-1',
          '2026-09-08',
        ),
      ).resolves.toEqual(expect.objectContaining({ date: '2026-09-08' }));
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
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      await expect(
        service.getDayForMembership(
          'org-1',
          'manager-user',
          'target-1',
          undefined,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when either membership cannot be found', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne }),
        makeTimeEntriesService(),
        makeOrganisationsService(),
      );

      await expect(
        service.getDayForMembership('org-1', 'user-1', 'missing', undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
