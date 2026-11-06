import { calendarWeekAt, dateKeyInZone } from './calendar-week.util';

describe('calendarWeekAt', () => {
  it("works out the week on the organisation's calendar, east of UTC", () => {
    // Monday 2 Nov 2026, 01:00 in Madagascar — still Sunday in UTC.
    const week = calendarWeekAt(
      new Date('2026-11-01T22:00:00Z'),
      'Indian/Antananarivo',
      'monday',
    );

    expect(week.todayKey).toBe('2026-11-02');
    expect(week.dayKeys).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(week.weekStart.toISOString()).toBe('2026-11-01T21:00:00.000Z');
    expect(week.weekEnd.toISOString()).toBe('2026-11-08T21:00:00.000Z');
    expect(week.lastWeekStart.toISOString()).toBe('2026-10-25T21:00:00.000Z');
    expect(week.todayStart.toISOString()).toBe('2026-11-01T21:00:00.000Z');
    expect(week.yesterdayStart.toISOString()).toBe('2026-10-31T21:00:00.000Z');
  });

  it('works out the week west of UTC', () => {
    // Sunday 8 Nov 2026, 22:00 in New York — already Monday in UTC.
    const week = calendarWeekAt(
      new Date('2026-11-09T03:00:00Z'),
      'America/New_York',
      'monday',
    );

    expect(week.todayKey).toBe('2026-11-08');
    expect(week.weekStart.toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });

  it('starts on Sunday when the organisation does', () => {
    const week = calendarWeekAt(
      new Date('2026-11-04T09:00:00Z'),
      'Indian/Antananarivo',
      'sunday',
    );

    expect(week.dayKeys[0]).toBe('2026-11-01');
    expect(week.weekStart.toISOString()).toBe('2026-10-31T21:00:00.000Z');
  });

  it('keeps every boundary on midnight across a daylight-saving change', () => {
    // US clocks went back on Sunday 1 Nov 2026.
    const week = calendarWeekAt(
      new Date('2026-11-04T17:00:00Z'),
      'America/New_York',
      'sunday',
    );

    expect(week.weekStart.toISOString()).toBe('2026-11-01T04:00:00.000Z'); // EDT
    expect(week.weekEnd.toISOString()).toBe('2026-11-08T05:00:00.000Z'); // EST
    expect(week.lastWeekStart.toISOString()).toBe('2026-10-25T04:00:00.000Z');
  });
});

describe('dateKeyInZone', () => {
  it("puts work just after the organisation's midnight on its own day", () => {
    expect(
      dateKeyInZone(new Date('2026-11-01T22:30:00Z'), 'Indian/Antananarivo'),
    ).toBe('2026-11-02');
    expect(dateKeyInZone(new Date('2026-11-01T22:30:00Z'), 'UTC')).toBe(
      '2026-11-01',
    );
  });
});
