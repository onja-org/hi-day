import { resolveReportDateRange } from './report-date-range.util';

// Thursday 1 October 2026, midday UTC.
const NOW = new Date('2026-10-01T12:00:00Z');
const days = (preset: Parameters<typeof resolveReportDateRange>[0]) => {
  const { from, to } = resolveReportDateRange(preset, NOW, 'UTC');
  return [from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)];
};

describe('resolveReportDateRange', () => {
  it('today and yesterday', () => {
    expect(days('today')).toEqual(['2026-10-01', '2026-10-01']);
    expect(days('yesterday')).toEqual(['2026-09-30', '2026-09-30']);
  });

  it('the last 7 days include today', () => {
    expect(days('last_7_days')).toEqual(['2026-09-25', '2026-10-01']);
  });

  it('last week is the whole previous Monday–Sunday', () => {
    expect(days('last_week')).toEqual(['2026-09-21', '2026-09-27']);
  });

  it('last 2 weeks is the two whole weeks before this one', () => {
    expect(days('last_2_weeks')).toEqual(['2026-09-14', '2026-09-27']);
  });

  it('this month runs to today', () => {
    expect(days('this_month')).toEqual(['2026-10-01', '2026-10-01']);
  });

  it('starts last week on Sunday for an organisation whose weeks do', () => {
    // NOW is Thu 1 Oct 2026: last week ran Sun 20 – Sat 26 Sep.
    const { from, to } = resolveReportDateRange(
      'last_week',
      NOW,
      'UTC',
      'sunday',
    );
    expect([from, to].map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-09-20',
      '2026-09-26',
    ]);
  });

  // The same cases as the frontend's getTimesheetDateRange.test.ts, so a
  // saved or scheduled "This week" covers the days the browser showed.
  describe('this week — the whole calendar week, not seven days back', () => {
    const thisWeek = (
      iso: string,
      weekStartsOn: 'monday' | 'sunday' = 'monday',
    ) => {
      const { from, to } = resolveReportDateRange(
        'this_week',
        new Date(iso),
        'UTC',
        weekStartsOn,
      );
      return [from, to].map((d) => d.toISOString().slice(0, 10));
    };

    it.each([
      ['a Wednesday', '2026-01-07T15:30:00Z'],
      ['a Monday', '2026-01-05T08:00:00Z'],
      ['a Sunday', '2026-01-11T21:00:00Z'],
    ])('covers Monday to Sunday on %s', (_label, iso) => {
      expect(thisWeek(iso)).toEqual(['2026-01-05', '2026-01-11']);
    });

    it('crosses a year boundary', () => {
      expect(thisWeek('2026-01-01T12:00:00Z')).toEqual([
        '2025-12-29',
        '2026-01-04',
      ]);
    });

    it.each([
      ['a Wednesday', '2026-01-07T15:30:00Z', ['2026-01-04', '2026-01-10']],
      [
        'a Sunday, its first day',
        '2026-01-11T09:00:00Z',
        ['2026-01-11', '2026-01-17'],
      ],
      [
        'a Saturday, its last day',
        '2026-01-10T09:00:00Z',
        ['2026-01-04', '2026-01-10'],
      ],
    ])(
      'runs Sunday to Saturday for an organisation whose weeks start on Sunday, on %s',
      (_label, iso, expected) => {
        expect(thisWeek(iso, 'sunday')).toEqual(expected);
      },
    );

    it('reads the week in the organisation zone', () => {
      // 22:30Z on Sunday 11 Jan is already Monday 12 Jan in Nairobi.
      const { from } = resolveReportDateRange(
        'this_week',
        new Date('2026-01-11T22:30:00Z'),
        'Africa/Nairobi',
      );
      expect(from.toISOString()).toBe('2026-01-11T21:00:00.000Z');
    });
  });

  it('last month is the whole previous month', () => {
    expect(days('last_month')).toEqual(['2026-09-01', '2026-09-30']);
  });

  it('crosses a year boundary for last month', () => {
    const { from, to } = resolveReportDateRange(
      'last_month',
      new Date('2026-01-10T12:00:00Z'),
      'UTC',
    );
    expect(from.toISOString().slice(0, 10)).toBe('2025-12-01');
    expect(to.toISOString().slice(0, 10)).toBe('2025-12-31');
  });

  it('reads "today" on the organisation clock, not the server clock', () => {
    // 22:00 UTC on 30 Sep is already 1 Oct in Nairobi.
    const { from } = resolveReportDateRange(
      'today',
      new Date('2026-09-30T22:00:00Z'),
      'Africa/Nairobi',
    );
    expect(from.toISOString()).toBe('2026-09-30T21:00:00.000Z');
  });

  it('covers a full day, to the last millisecond', () => {
    const { to } = resolveReportDateRange('today', NOW, 'UTC');
    expect(to.toISOString()).toBe('2026-10-01T23:59:59.999Z');
  });
});
