import {
  addDaysToKey,
  endOfDayInZone,
  mondayOfKey,
  startOfDayInZone,
  weekdayOfKey,
  zonedParts,
} from './zoned-time.util';

describe('zoned-time.util', () => {
  it('reads the wall clock in a zone', () => {
    const parts = zonedParts(
      new Date('2026-10-01T22:30:00Z'),
      'Africa/Nairobi',
    );
    expect(parts).toMatchObject({
      dateKey: '2026-10-02',
      hour: 1,
      minute: 30,
      weekday: 5,
    });
  });

  it('finds the start of a day in a zone ahead of UTC', () => {
    expect(startOfDayInZone('2026-10-02', 'Africa/Nairobi').toISOString()).toBe(
      '2026-10-01T21:00:00.000Z',
    );
  });

  it('finds the start of a day in a zone behind UTC', () => {
    expect(
      startOfDayInZone('2026-01-15', 'America/New_York').toISOString(),
    ).toBe('2026-01-15T05:00:00.000Z');
  });

  it('honours a daylight-saving change on that day', () => {
    // Clocks went forward on 2026-03-08 in New York: the day is 23 hours.
    const start = startOfDayInZone('2026-03-08', 'America/New_York');
    const end = endOfDayInZone('2026-03-08', 'America/New_York');
    expect(end.getTime() - start.getTime() + 1).toBe(23 * 60 * 60 * 1000);
  });

  it('ends a day one millisecond before the next begins', () => {
    expect(endOfDayInZone('2026-10-02', 'UTC').toISOString()).toBe(
      '2026-10-02T23:59:59.999Z',
    );
  });

  it('does date arithmetic across month ends', () => {
    expect(addDaysToKey('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysToKey('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('finds weekdays and the Monday of a week', () => {
    expect(weekdayOfKey('2026-10-01')).toBe(4);
    expect(mondayOfKey('2026-10-01')).toBe('2026-09-28');
    expect(mondayOfKey('2026-10-04')).toBe('2026-09-28');
    expect(mondayOfKey('2026-09-28')).toBe('2026-09-28');
  });
});
