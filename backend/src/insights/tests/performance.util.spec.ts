import { TimeEntryType } from '../../database/entities/time-entry-type.enum';
import {
  averagePerformance,
  computeMemberPerformance,
  MemberPerformance,
} from '../performance.util';
import { buildTimelineDays, DayBounds } from '../timeline.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const day = (date: string): DayBounds => {
  const start = new Date(`${date}T00:00:00Z`);
  return { date, start, end: new Date(start.getTime() + DAY_MS) };
};

const entry = (
  id: string,
  startedAt: string,
  endedAt: string,
  type: TimeEntryType = TimeEntryType.NORMAL,
) => ({
  id,
  startedAt: new Date(startedAt),
  endedAt: new Date(endedAt),
  type,
  idleSeconds: null,
});

const sample = (from: string, to: string, activePercentage: number) => ({
  periodStart: new Date(from),
  periodEnd: new Date(to),
  activePercentage,
});

/** Ten-minute samples at one activity level across [from, to). */
const samplesAt = (from: string, to: string, activePercentage: number) => {
  const out: ReturnType<typeof sample>[] = [];
  for (let t = Date.parse(from); t < Date.parse(to); t += 10 * 60 * 1000) {
    out.push(
      sample(
        new Date(t).toISOString(),
        new Date(t + 10 * 60 * 1000).toISOString(),
        activePercentage,
      ),
    );
  }
  return out;
};

// 2026-03-09 is a Monday.
const MON = '2026-03-09';
const TUE = '2026-03-10';
const SAT = '2026-03-14';
const now = new Date('2026-03-20T12:00:00Z');

function perform(
  dates: string[],
  entries: ReturnType<typeof entry>[],
  samples: ReturnType<typeof sample>[] = [],
  todayKey = '2026-03-20',
) {
  const days = dates.map(day);
  return computeMemberPerformance({
    days,
    timeline: buildTimelineDays(days, entries, new Map(), samples, now),
    samples,
    expectedWorkDays: [1, 2, 3, 4, 5],
    hoursPerDay: 8,
    todayKey,
  });
}

describe('computeMemberPerformance', () => {
  describe('utilization', () => {
    it('averages worked time over expected work days, counting weekend work', () => {
      const result = perform(
        [MON, TUE, SAT],
        [
          entry('a', `${MON}T09:00:00Z`, `${MON}T15:00:00Z`),
          entry(
            'b',
            `${TUE}T09:00:00Z`,
            `${TUE}T11:00:00Z`,
            TimeEntryType.MANUAL,
          ),
          entry('c', `${SAT}T10:00:00Z`, `${SAT}T12:00:00Z`),
        ],
      );

      // 6h + 2h + 2h over 2 expected days (Saturday isn't one).
      expect(result.utilization).toEqual({
        averageDailySeconds: 5 * 3600,
        targetDailySeconds: 8 * 3600,
        expectedDays: 2,
      });
    });

    it('leaves out days that have not happened yet', () => {
      const result = perform(
        [MON, TUE],
        [entry('a', `${MON}T09:00:00Z`, `${MON}T13:00:00Z`)],
        [],
        MON,
      );

      expect(result.utilization?.expectedDays).toBe(1);
      expect(result.utilization?.averageDailySeconds).toBe(4 * 3600);
    });

    it('has no figure when no expected day has passed', () => {
      expect(perform([SAT], []).utilization).toBeNull();
    });

    it('has no figure when nothing was worked at all', () => {
      expect(perform([MON, TUE], []).utilization).toBeNull();
    });
  });

  describe('activity and focus', () => {
    it('has neither without measurements', () => {
      const result = perform(
        [MON],
        [entry('a', `${MON}T09:00:00Z`, `${MON}T10:00:00Z`)],
      );

      expect(result.activity).toBeNull();
      expect(result.focus).toBeNull();
    });

    it('counts a 20-minute stretch at or above 50% as one session', () => {
      const result = perform(
        [MON],
        [entry('a', `${MON}T09:00:00Z`, `${MON}T10:00:00Z`)],
        [
          ...samplesAt(`${MON}T09:00:00Z`, `${MON}T09:30:00Z`, 70),
          ...samplesAt(`${MON}T09:30:00Z`, `${MON}T10:00:00Z`, 20),
        ],
      );

      expect(result.activity).toEqual({ percentage: 45 });
      expect(result.focus).toEqual({
        totalSeconds: 1800,
        sessions: 1,
        averageSessionSeconds: 1800,
      });
    });

    it('splits sessions at a low sample and drops ones under 20 minutes', () => {
      const result = perform(
        [MON],
        [entry('a', `${MON}T09:00:00Z`, `${MON}T11:00:00Z`)],
        [
          ...samplesAt(`${MON}T09:00:00Z`, `${MON}T09:40:00Z`, 80),
          ...samplesAt(`${MON}T09:40:00Z`, `${MON}T09:50:00Z`, 10),
          ...samplesAt(`${MON}T09:50:00Z`, `${MON}T10:00:00Z`, 80),
          ...samplesAt(`${MON}T10:00:00Z`, `${MON}T10:10:00Z`, 10),
          ...samplesAt(`${MON}T10:10:00Z`, `${MON}T11:00:00Z`, 60),
        ],
      );

      // 40 min and 50 min count; the lone 10 min between lows doesn't.
      expect(result.focus).toEqual({
        totalSeconds: 90 * 60,
        sessions: 2,
        averageSessionSeconds: 45 * 60,
      });
    });

    it('never counts focus outside tracked time', () => {
      const result = perform(
        [MON],
        [entry('a', `${MON}T09:00:00Z`, `${MON}T09:15:00Z`)],
        samplesAt(`${MON}T09:00:00Z`, `${MON}T10:00:00Z`, 90),
      );

      expect(result.focus).toEqual({
        totalSeconds: 0,
        sessions: 0,
        averageSessionSeconds: 0,
      });
    });
  });

  describe('start / stop', () => {
    it('takes the median first start and last stop over worked days', () => {
      const result = perform(
        [MON, TUE, '2026-03-11'],
        [
          entry('a', `${MON}T08:00:00Z`, `${MON}T16:00:00Z`),
          entry('b', `${TUE}T09:00:00Z`, `${TUE}T12:00:00Z`),
          entry('c', `${TUE}T13:00:00Z`, `${TUE}T17:30:00Z`),
          entry('d', '2026-03-11T10:00:00Z', '2026-03-11T18:00:00Z'),
        ],
      );

      expect(result.startStop).toEqual({
        startMinute: 9 * 60,
        stopMinute: 17 * 60 + 30,
        days: 3,
      });
    });

    it('ignores days with only idle time', () => {
      const result = perform(
        [MON],
        [
          entry(
            'a',
            `${MON}T07:00:00Z`,
            `${MON}T08:00:00Z`,
            TimeEntryType.IDLE,
          ),
        ],
      );

      expect(result.startStop).toBeNull();
    });
  });

  describe('idle', () => {
    it('is idle time as a share of tracked plus idle', () => {
      const result = perform(
        [MON],
        [
          entry('a', `${MON}T09:00:00Z`, `${MON}T12:00:00Z`),
          entry(
            'b',
            `${MON}T12:00:00Z`,
            `${MON}T13:00:00Z`,
            TimeEntryType.IDLE,
          ),
          entry(
            'c',
            `${MON}T14:00:00Z`,
            `${MON}T18:00:00Z`,
            TimeEntryType.MANUAL,
          ),
        ],
      );

      expect(result.idle).toEqual({ idleSeconds: 3600, idleShare: 0.25 });
    });

    it('has no figure with nothing tracked', () => {
      expect(perform([MON], []).idle).toBeNull();
    });
  });
});

describe('averagePerformance', () => {
  const blank: MemberPerformance = {
    utilization: null,
    activity: null,
    focus: null,
    startStop: null,
    idle: null,
  };

  it('averages each figure over the members who have one', () => {
    const result = averagePerformance([
      {
        ...blank,
        utilization: {
          averageDailySeconds: 6 * 3600,
          targetDailySeconds: 8 * 3600,
          expectedDays: 5,
        },
        activity: { percentage: 60 },
      },
      {
        ...blank,
        utilization: {
          averageDailySeconds: 8 * 3600,
          targetDailySeconds: 8 * 3600,
          expectedDays: 5,
        },
      },
    ]);

    expect(result.averageDailySeconds).toBe(7 * 3600);
    // Only one member was measured, so they alone set the average.
    expect(result.activityPercentage).toBe(60);
    expect(result.focusSeconds).toBeNull();
    expect(result.members).toBe(2);
  });
});
