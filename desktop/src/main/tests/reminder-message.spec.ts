import { describe, expect, it } from 'vitest';
import { reminderMessage } from '../../renderer/reminder-message';

const BASE = {
  untrackedMinutes: 25,
  signedOut: false,
  workingHoursPerDay: 8,
  trackedTodaySeconds: 3 * 3600 + 26 * 60,
};

describe('reminderMessage', () => {
  it('says how long since they stopped, once they have tracked something', () => {
    expect(reminderMessage(BASE)).toContain(
      'You have not tracked time in 25 minutes.',
    );
  });

  it('says they have tracked nothing at all, rather than a duration', () => {
    const message = reminderMessage({ ...BASE, trackedTodaySeconds: 0 });

    expect(message).toContain('You have not tracked any time today.');
    expect(message).not.toContain('25 minutes');
  });

  it('counts what is left of the working day against what was tracked', () => {
    // 8h expected, 3h26m tracked.
    expect(reminderMessage(BASE)).toContain(
      'There are 4 hours, 34 minutes remaining in your work day.',
    );
  });

  it('drops the remaining line once the day is already full', () => {
    const message = reminderMessage({ ...BASE, trackedTodaySeconds: 9 * 3600 });

    expect(message).not.toContain('remaining in your work day');
  });

  it('tells a signed-out person what to do about it', () => {
    expect(reminderMessage({ ...BASE, signedOut: true })).toContain(
      'Open Hi Day and log in',
    );
  });
});
