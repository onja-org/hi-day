import { dueSummaryPeriods } from '../summary-period.util';

describe('dueSummaryPeriods', () => {
  it('sends nothing before 07:00 in the organisation timezone', () => {
    // 06:30 in Madagascar (UTC+3) on Tue 2026-11-24.
    const now = new Date('2026-11-24T03:30:00Z');
    expect(dueSummaryPeriods(now, 'Indian/Antananarivo', 'monday')).toEqual([]);
  });

  it('sends yesterday from 07:00 on an ordinary day', () => {
    const now = new Date('2026-11-24T04:00:00Z'); // 07:00 Tue in UTC+3
    expect(dueSummaryPeriods(now, 'Indian/Antananarivo', 'monday')).toEqual([
      {
        period: 'daily',
        range: { fromKey: '2026-11-23', toKey: '2026-11-23' },
        previous: { fromKey: '2026-11-22', toKey: '2026-11-22' },
      },
    ]);
  });

  it('adds last week on the first day of a Monday week', () => {
    const now = new Date('2026-11-23T09:00:00Z'); // Monday
    const due = dueSummaryPeriods(now, 'UTC', 'monday');
    expect(due.map((d) => d.period)).toEqual(['daily', 'weekly']);
    expect(due[1].range).toEqual({
      fromKey: '2026-11-16',
      toKey: '2026-11-22',
    });
    expect(due[1].previous).toEqual({
      fromKey: '2026-11-09',
      toKey: '2026-11-15',
    });
  });

  it('follows a Sunday week start', () => {
    const monday = new Date('2026-11-23T09:00:00Z');
    expect(
      dueSummaryPeriods(monday, 'UTC', 'sunday').map((d) => d.period),
    ).toEqual(['daily']);
    const sunday = new Date('2026-11-22T09:00:00Z');
    const due = dueSummaryPeriods(sunday, 'UTC', 'sunday');
    expect(due[1].range).toEqual({
      fromKey: '2026-11-15',
      toKey: '2026-11-21',
    });
  });

  it("uses the organisation's calendar day, not UTC's", () => {
    // 23:30 UTC Sunday is 07:30 Monday in Perth (UTC+8).
    const now = new Date('2026-11-22T23:30:00Z');
    const due = dueSummaryPeriods(now, 'Australia/Perth', 'monday');
    expect(due.map((d) => d.period)).toEqual(['daily', 'weekly']);
    expect(due[0].range.fromKey).toBe('2026-11-22');
  });
});
