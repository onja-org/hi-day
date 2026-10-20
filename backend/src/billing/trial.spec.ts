import {
  dueTrialReminderDaysLeft,
  isTrialExpired,
  trialDaysLeft,
  trialEndFrom,
  TRIAL_DAYS,
} from './trial';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const START = new Date('2026-01-01T09:00:00.000Z');
const END = trialEndFrom(START);

/** `daysBeforeEnd(0.5)` = twelve hours before the trial runs out. */
function daysBeforeEnd(days: number): Date {
  return new Date(END.getTime() - days * MS_PER_DAY);
}

describe('trialEndFrom', () => {
  it('ends 14 days after it starts, to the same instant', () => {
    expect(END.getTime() - START.getTime()).toBe(TRIAL_DAYS * MS_PER_DAY);
    expect(END.toISOString()).toBe('2026-01-15T09:00:00.000Z');
  });
});

describe('trialDaysLeft', () => {
  it('counts the whole trial on the day it starts', () => {
    expect(trialDaysLeft(END, START)).toBe(14);
  });

  it('rounds up, so a part-used day still counts', () => {
    expect(trialDaysLeft(END, daysBeforeEnd(2.5))).toBe(3);
  });

  it('reads 1, not 0, through the whole final day', () => {
    expect(trialDaysLeft(END, daysBeforeEnd(1))).toBe(1);
    expect(trialDaysLeft(END, daysBeforeEnd(0.001))).toBe(1);
  });

  it('is zero once the trial has run out, never negative', () => {
    expect(trialDaysLeft(END, END)).toBe(0);
    expect(trialDaysLeft(END, new Date(END.getTime() + 30 * MS_PER_DAY))).toBe(
      0,
    );
  });
});

describe('isTrialExpired', () => {
  it('is false right up to the end instant and true from it', () => {
    expect(isTrialExpired(END, daysBeforeEnd(0.0001))).toBe(false);
    expect(isTrialExpired(END, END)).toBe(true);
  });
});

describe('dueTrialReminderDaysLeft', () => {
  it('sends nothing while the trial is young', () => {
    expect(dueTrialReminderDaysLeft(END, daysBeforeEnd(10), null)).toBeNull();
  });

  it('sends the three-day reminder once the trial reaches it', () => {
    expect(dueTrialReminderDaysLeft(END, daysBeforeEnd(2.5), null)).toBe(3);
  });

  it('does not repeat a milestone it has already sent', () => {
    expect(dueTrialReminderDaysLeft(END, daysBeforeEnd(2.5), 3)).toBeNull();
  });

  it('sends the final-day reminder after the three-day one', () => {
    expect(dueTrialReminderDaysLeft(END, daysBeforeEnd(0.5), 3)).toBe(1);
  });

  it('sends only the most urgent milestone when the job missed one', () => {
    expect(dueTrialReminderDaysLeft(END, daysBeforeEnd(0.5), null)).toBe(1);
  });

  it('sends the trial-has-ended reminder once it runs out', () => {
    const justAfter = new Date(END.getTime() + 60 * 60 * 1000);
    expect(dueTrialReminderDaysLeft(END, justAfter, 1)).toBe(0);
  });

  it('stops once the ended reminder has gone out', () => {
    const justAfter = new Date(END.getTime() + 60 * 60 * 1000);
    expect(dueTrialReminderDaysLeft(END, justAfter, 0)).toBeNull();
  });

  it('says nothing once the grace period itself has passed', () => {
    const afterGrace = new Date(END.getTime() + 4 * MS_PER_DAY);
    expect(dueTrialReminderDaysLeft(END, afterGrace, null)).toBeNull();
  });
});
