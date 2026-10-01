import { isScheduleDue } from './report-schedule.util';

const weekly = { frequency: 'weekly' as const, hour: 9, days: [1, 3] };
// Monday 28 Sep 2026 and Tuesday 29 Sep 2026.
const mondayAt = (hourUtc: number) =>
  new Date(`2026-09-28T${String(hourUtc).padStart(2, '0')}:15:00Z`);

describe('isScheduleDue', () => {
  it('is not due before the delivery hour', () => {
    expect(isScheduleDue(weekly, mondayAt(8), 'UTC', null)).toBe(false);
  });

  it('is due from the delivery hour on a chosen weekday', () => {
    expect(isScheduleDue(weekly, mondayAt(9), 'UTC', null)).toBe(true);
  });

  it('still sends later the same day if it was missed', () => {
    expect(isScheduleDue(weekly, mondayAt(15), 'UTC', null)).toBe(true);
  });

  it('is not due again once sent that day', () => {
    expect(isScheduleDue(weekly, mondayAt(15), 'UTC', '2026-09-28')).toBe(
      false,
    );
  });

  it('is due again the next chosen day', () => {
    const wednesday = new Date('2026-09-30T09:15:00Z');
    expect(isScheduleDue(weekly, wednesday, 'UTC', '2026-09-28')).toBe(true);
  });

  it('is not due on a weekday that was not chosen', () => {
    const tuesday = new Date('2026-09-29T10:00:00Z');
    expect(isScheduleDue(weekly, tuesday, 'UTC', null)).toBe(false);
  });

  it('reads the hour and the day on the organisation clock', () => {
    // 06:15 UTC Monday is 09:15 in Nairobi — due there, not in UTC.
    const instant = new Date('2026-09-28T06:15:00Z');
    expect(isScheduleDue(weekly, instant, 'Africa/Nairobi', null)).toBe(true);
    expect(isScheduleDue(weekly, instant, 'UTC', null)).toBe(false);
  });

  describe('monthly', () => {
    const monthly = { frequency: 'monthly' as const, hour: 9, days: [1] };

    it('is due on the first chosen weekday of the month', () => {
      // Monday 5 Oct 2026 is the first Monday of October.
      expect(
        isScheduleDue(monthly, new Date('2026-10-05T10:00:00Z'), 'UTC', null),
      ).toBe(true);
    });

    it('is not due on later chosen weekdays that month', () => {
      expect(
        isScheduleDue(monthly, new Date('2026-10-12T10:00:00Z'), 'UTC', null),
      ).toBe(false);
    });

    it('counts the 1st itself when it is a chosen weekday', () => {
      // Monday 1 Jun 2026.
      expect(
        isScheduleDue(monthly, new Date('2026-06-01T10:00:00Z'), 'UTC', null),
      ).toBe(true);
    });
  });
});
