import { describe, expect, it } from 'vitest';
import {
  hasTrackedFullWorkDay,
  shouldRemind,
  type ReminderInput,
} from '../tracking-reminder';

function input(overrides: Partial<ReminderInput> = {}): ReminderInput {
  return {
    settings: { intervalMinutes: 10, delivery: 'alert', workingHoursPerDay: 8 },
    now: new Date('2026-10-14T09:10:00'),
    isTracking: false,
    idleSeconds: 0,
    since: new Date('2026-10-14T09:00:00'),
    ...overrides,
  };
}

describe('shouldRemind', () => {
  it('nudges once a full interval has gone untracked', () => {
    expect(shouldRemind(input())).toBe(true);
  });

  it('stays quiet before the interval is up', () => {
    expect(shouldRemind(input({ now: new Date('2026-10-14T09:05:00') }))).toBe(
      false,
    );
  });

  it('never nudges someone whose timer is already running', () => {
    expect(shouldRemind(input({ isTracking: true }))).toBe(false);
  });

  it('stays quiet at a machine nobody is sitting at', () => {
    expect(shouldRemind(input({ idleSeconds: 45 * 60 }))).toBe(false);
  });

  it('is off entirely when the interval is zero', () => {
    expect(
      shouldRemind(input({ settings: { intervalMinutes: 0, delivery: 'alert', workingHoursPerDay: 8 } })),
    ).toBe(false);
  });

  it('does nothing before the settings have arrived', () => {
    expect(shouldRemind(input({ settings: null }))).toBe(false);
  });
});

describe('hasTrackedFullWorkDay', () => {
  const EIGHT_HOURS = 8 * 3600;

  it('is false with hours still to track', () => {
    expect(hasTrackedFullWorkDay(EIGHT_HOURS - 60, 8)).toBe(false);
  });

  it('is true the moment the day is met, and past it', () => {
    expect(hasTrackedFullWorkDay(EIGHT_HOURS, 8)).toBe(true);
    expect(hasTrackedFullWorkDay(EIGHT_HOURS + 3600, 8)).toBe(true);
  });

  // Nothing configured means nothing to be full of: a reminder is still the
  // right answer, rather than every day counting as already done.
  it('is false when no day length is configured', () => {
    expect(hasTrackedFullWorkDay(EIGHT_HOURS, 0)).toBe(false);
  });

  it('is false for a day with nothing tracked', () => {
    expect(hasTrackedFullWorkDay(0, 8)).toBe(false);
  });
});
