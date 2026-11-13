import { ForbiddenException } from '@nestjs/common';
import type { OrganisationsService } from '../../../organisations/services/organisations.service';
import type { TimeEntriesService } from '../../../time-entries/services/time-entries.service';
import type { DayBounds } from '../../timeline.util';
import type { UnusualInstance } from '../../unusual-activity.util';
import { HighlightsService } from '../highlights.service';
import type {
  ActivityStatus,
  InsightsService,
  WorkTimeClassification,
} from '../insights.service';
import type {
  MemberUnusualActivity,
  UnusualActivityService,
} from '../unusual-activity.service';

const target = { id: 'membership-2', expectedWorkDays: null };

const instance = (
  severity: UnusualInstance['severity'],
  durationSeconds = 600,
): UnusualInstance => ({ severity, durationSeconds }) as UnusualInstance;

const unusual = (
  overrides: Partial<MemberUnusualActivity> = {},
): MemberUnusualActivity => ({
  membershipId: target.id,
  timezone: 'UTC',
  activityStatus: 'recorded',
  checkedThrough: '2026-11-08',
  instances: [],
  affectedSeconds: { highly_unusual: 0, unusual: 0, slightly_unusual: 0 },
  previousPeriod: {
    from: '2026-09-03',
    to: '2026-11-01',
    affectedSeconds: { highly_unusual: 0, unusual: 0, slightly_unusual: 0 },
  },
  normalForMember: [],
  ...overrides,
});

/** Core time per period, keyed by the period's first day. */
type CoreByPeriod = Record<string, { core: number; other: number }>;

interface Options {
  report?: MemberUnusualActivity;
  activityStatus?: ActivityStatus;
  coreByPeriod?: CoreByPeriod;
  /** Not on any team the caller manages, so the shared access check refuses. */
  forbidden?: boolean;
}

function makeService({
  report = unusual(),
  activityStatus = 'recorded',
  coreByPeriod = {},
  forbidden = false,
}: Options = {}) {
  const workTimeClassificationFor = jest.fn(
    (
      _organisationId: string,
      _target: unknown,
      _tracking: unknown,
      _status: unknown,
      days: DayBounds[],
    ): Promise<WorkTimeClassification> => {
      const split = coreByPeriod[days[0].date];
      return Promise.resolve(
        split
          ? {
              status: 'available',
              coreSeconds: split.core,
              nonCoreSeconds: split.other,
              unclassifiedSeconds: 0,
            }
          : { status: 'no_data' },
      );
    },
  );
  const insightsService = {
    getViewableMembership: forbidden
      ? jest
          .fn()
          .mockRejectedValue(
            new ForbiddenException("You cannot view this member's insights."),
          )
      : jest.fn().mockResolvedValue({ caller: { id: 'membership-1' }, target }),
    dayKeysBetween: jest.fn(),
    activityStatusFor: jest.fn().mockResolvedValue(activityStatus),
    workTimeClassificationFor,
  } as unknown as InsightsService;
  const getUnusualActivity = jest.fn().mockResolvedValue(report);
  const unusualActivityService = {
    getUnusualActivity,
  } as unknown as UnusualActivityService;
  const organisationsService = {
    getInsightsDefaults: jest.fn().mockResolvedValue({
      timezone: 'UTC',
      hoursPerDay: 8,
      expectedWorkDays: [1, 2, 3, 4, 5],
      activityTrackingEnabled: true,
      appUrlTracking: 'apps',
    }),
  } as unknown as OrganisationsService;
  const timelineWindow = jest
    .fn()
    .mockResolvedValue({ entries: [], pausesByEntry: new Map(), samples: [] });
  const timeEntriesService = {
    timelineWindow,
  } as unknown as TimeEntriesService;

  const service = new HighlightsService(
    insightsService,
    unusualActivityService,
    organisationsService,
    timeEntriesService,
  );
  const highlights = () =>
    service.getHighlights(
      'org-1',
      'user-1',
      target.id,
      '2026-11-02',
      '2026-11-08',
    );
  return {
    highlights,
    workTimeClassificationFor,
    getUnusualActivity,
    timelineWindow,
  };
}

describe('HighlightsService', () => {
  it('refuses a manager looking at someone outside their teams, before reading anything', async () => {
    const {
      highlights,
      getUnusualActivity,
      timelineWindow,
      workTimeClassificationFor,
    } = makeService({ forbidden: true });

    await expect(highlights()).rejects.toBeInstanceOf(ForbiddenException);
    expect(getUnusualActivity).not.toHaveBeenCalled();
    expect(timelineWindow).not.toHaveBeenCalled();
    expect(workTimeClassificationFor).not.toHaveBeenCalled();
  });

  it('counts and totals unusual activity exactly as the Unusual activity page does', async () => {
    const { highlights } = makeService({
      report: unusual({
        instances: [
          instance('highly_unusual'),
          instance('unusual'),
          instance('unusual'),
        ],
        affectedSeconds: {
          highly_unusual: 7200,
          unusual: 3000,
          slightly_unusual: 0,
        },
        previousPeriod: {
          from: '2026-09-03',
          to: '2026-11-01',
          affectedSeconds: {
            highly_unusual: 0,
            unusual: 0,
            slightly_unusual: 1800,
          },
        },
      }),
    });

    expect((await highlights()).unusualActivity).toEqual({
      counts: { highly_unusual: 1, unusual: 2, slightly_unusual: 0 },
      affectedSeconds: 10200,
      previousAffectedSeconds: 1800,
      topInstances: expect.any(Array) as unknown,
    });
  });

  it('lists the 3 most serious instances, most severe then longest first', async () => {
    const { highlights } = makeService({
      report: unusual({
        instances: [
          instance('slightly_unusual', 9000),
          instance('unusual', 1200),
          instance('highly_unusual', 600),
          instance('unusual', 4800),
          instance('slightly_unusual', 600),
          instance('unusual', 2400),
        ],
      }),
    });

    const { topInstances } = (await highlights()).unusualActivity;

    expect(
      topInstances.map((item) => [item.severity, item.durationSeconds]),
    ).toEqual([
      ['highly_unusual', 600],
      ['unusual', 4800],
      ['unusual', 2400],
    ]);
  });

  it('compares the week with the 3 weeks just before it', async () => {
    const { highlights, workTimeClassificationFor } = makeService();

    const { behaviourChanges } = await highlights();

    expect(behaviourChanges.comparedWith).toEqual({
      from: '2026-10-12',
      to: '2026-11-01',
      periods: 3,
    });
    expect(behaviourChanges.periodDays).toBe(7);
    expect(behaviourChanges.checkedDays).toBe(7);
    const periods = workTimeClassificationFor.mock.calls.map(
      ([, , , , days]) => `${days[0].date}..${days[days.length - 1].date}`,
    );
    expect(periods.sort()).toEqual([
      '2026-10-12..2026-10-18',
      '2026-10-19..2026-10-25',
      '2026-10-26..2026-11-01',
      '2026-11-02..2026-11-08',
    ]);
  });

  it('notes core work that dropped 15% or more from the member’s own average', async () => {
    const { highlights } = makeService({
      coreByPeriod: {
        '2026-11-02': { core: 40, other: 60 },
        '2026-10-26': { core: 50, other: 50 },
        '2026-10-19': { core: 50, other: 50 },
        '2026-10-12': { core: 50, other: 50 },
      },
    });

    expect((await highlights()).behaviourChanges.changes).toEqual([
      {
        metric: 'core_work',
        direction: 'lower',
        changePercent: 20,
        current: 0.4,
        average: 0.5,
      },
    ]);
  });

  it('while the week runs into today, compares its finished days with the same days of the 3 weeks before', async () => {
    const { highlights, workTimeClassificationFor } = makeService({
      report: unusual({ checkedThrough: '2026-11-04' }),
    });

    const { behaviourChanges } = await highlights();

    expect(behaviourChanges.periodDays).toBe(7);
    expect(behaviourChanges.checkedDays).toBe(3);
    expect(behaviourChanges.comparedWith).toEqual({
      from: '2026-10-12',
      to: '2026-10-28',
      periods: 3,
    });
    const periods = workTimeClassificationFor.mock.calls.map(
      ([, , , , days]) => `${days[0].date}..${days[days.length - 1].date}`,
    );
    // Mon–Wed of each week.
    expect(periods.sort()).toEqual([
      '2026-10-12..2026-10-14',
      '2026-10-19..2026-10-21',
      '2026-10-26..2026-10-28',
      '2026-11-02..2026-11-04',
    ]);
  });

  it('has nothing to compare while no day in the range is over', async () => {
    const { highlights, workTimeClassificationFor } = makeService({
      report: unusual({ checkedThrough: null }),
    });

    const result = await highlights();

    expect(result.checkedThrough).toBeNull();
    expect(result.behaviourChanges).toEqual({
      comparedWith: null,
      periodDays: 0,
      checkedDays: 0,
      changes: [],
    });
    expect(workTimeClassificationFor).not.toHaveBeenCalled();
  });

  it('gives no notes to a member who may not see their own activity', async () => {
    const { highlights, workTimeClassificationFor } = makeService({
      activityStatus: 'hidden',
      coreByPeriod: {
        '2026-11-02': { core: 10, other: 90 },
        '2026-10-26': { core: 90, other: 10 },
      },
    });

    expect((await highlights()).behaviourChanges.changes).toEqual([]);
    expect(workTimeClassificationFor).not.toHaveBeenCalled();
  });
});
