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
import { AppEventsService } from '../app-events.service';

describe('AppEventsService', () => {
  function makeAppEventsRepo(
    rawRows: { appName: string; sampleCount: string }[] = [],
  ) {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rawRows),
    };
    const save = jest.fn().mockResolvedValue(undefined);
    const repo = {
      create: jest.fn((data: unknown) => data),
      save,
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
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

    it('throws when the caller has no active membership in the organisation', async () => {
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne: jest.fn().mockResolvedValue(null) }),
      );

      await expect(
        service.recordBatch('org-1', 'user-1', 'device-1', []),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getMySummary', () => {
    it("resolves the caller's own membership and sums seconds per app (5s per sample)", async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const { repo: appEventsRepo } = makeAppEventsRepo([
        { appName: 'Google Chrome', sampleCount: '10' },
        { appName: 'Slack', sampleCount: '4' },
      ]);
      const service = new AppEventsService(
        appEventsRepo,
        makeMembershipsRepo({ findOne }),
      );

      const summary = await service.getMySummary(
        'org-1',
        'user-1',
        '2026-09-08',
      );

      expect(summary).toEqual({
        date: '2026-09-08',
        totalSecondsSpent: 70,
        items: [
          { appName: 'Google Chrome', secondsSpent: 50 },
          { appName: 'Slack', secondsSpent: 20 },
        ],
      });
    });

    it('defaults to today when no date is given', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne }),
      );

      const summary = await service.getMySummary('org-1', 'user-1');

      expect(summary.date).toBe(new Date().toISOString().slice(0, 10));
    });

    it('rejects a malformed date', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 'membership-1' });
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne }),
      );

      await expect(
        service.getMySummary('org-1', 'user-1', 'not-a-date'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getSummaryForMembership', () => {
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
      );

      await expect(
        service.getSummaryForMembership(
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
      );

      await expect(
        service.getSummaryForMembership('org-1', 'manager-user', 'target-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws when either membership cannot be found', async () => {
      const findOne = jest.fn().mockResolvedValue(null);
      const service = new AppEventsService(
        makeAppEventsRepo().repo,
        makeMembershipsRepo({ findOne }),
      );

      await expect(
        service.getSummaryForMembership('org-1', 'user-1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
