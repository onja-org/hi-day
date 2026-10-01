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
