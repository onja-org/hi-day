import { BadRequestException } from '@nestjs/common';
import { activityDayIn } from './activity-day.util';

describe('activityDayIn', () => {
  it("starts the day at the organisation's midnight, east of UTC", () => {
    const day = activityDayIn('2026-11-02', 'Africa/Nairobi');

    expect(day.date).toBe('2026-11-02');
    expect(day.start.toISOString()).toBe('2026-11-01T21:00:00.000Z');
    expect(day.end.toISOString()).toBe('2026-11-02T21:00:00.000Z');
  });

  it("defaults to today on the organisation's calendar, not UTC's", () => {
    // 01:30 on Tuesday 3 Nov in Nairobi — still Monday in UTC.
    const day = activityDayIn(
      undefined,
      'Africa/Nairobi',
      new Date('2026-11-02T22:30:00Z'),
    );

    expect(day.date).toBe('2026-11-03');
  });

  it('keeps a west-of-UTC evening on the same day', () => {
    // 20:00 on Monday 2 Nov in New York — already Tuesday in UTC.
    const day = activityDayIn(
      undefined,
      'America/New_York',
      new Date('2026-11-03T01:00:00Z'),
    );

    expect(day.date).toBe('2026-11-02');
    expect(day.start.toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(day.end.toISOString()).toBe('2026-11-03T05:00:00.000Z');
  });

  it('gives a daylight-saving day its 25 hours', () => {
    // US clocks went back on Sunday 1 Nov 2026.
    const day = activityDayIn('2026-11-01', 'America/New_York');

    expect(day.start.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(day.end.toISOString()).toBe('2026-11-02T05:00:00.000Z');
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    expect(() => activityDayIn('2/11/2026', 'UTC')).toThrow(
      BadRequestException,
    );
  });
});
