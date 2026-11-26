import { describe, expect, it } from 'vitest';
import {
  formatRefusedAt,
  refusedTimeNotice,
} from '../../renderer/refused-time-notice';

const STOP = {
  op: { type: 'stop' as const, at: '2026-11-25T15:15:00.000Z' },
  message: 'No timer is currently running on this device',
};

describe('refusedTimeNotice', () => {
  it('names the date as well as the time, so an old refusal is not read as today', () => {
    const notice = refusedTimeNotice([STOP], { timerStopped: true });
    expect(notice.body).toContain(
      `${formatRefusedAt(STOP.op.at)} — No timer is currently running on this device`,
    );
    expect(formatRefusedAt(STOP.op.at)).toMatch(/25/);
  });

  it('offers to resume when the timer is stopped, and says it is', () => {
    const notice = refusedTimeNotice([STOP], { timerStopped: true });
    expect(notice.offerResume).toBe(true);
    expect(notice.body).toContain('Your timer is stopped.');
  });

  it('offers nothing to resume when a timer is already running', () => {
    const notice = refusedTimeNotice([STOP], { timerStopped: false });
    expect(notice.offerResume).toBe(false);
    expect(notice.body).not.toContain('Your timer is stopped.');
  });

  it('does not blame being offline or asleep: a refusal has other causes', () => {
    const notice = refusedTimeNotice([STOP], { timerStopped: true });
    expect(notice.title).toBe("Some of your time couldn't be saved");
    expect(notice.body).not.toMatch(/offline|asleep|sleep/i);
    expect(notice.body).toContain('timesheet in the web app');
  });

  it('lists every refusal, one per line', () => {
    const second = {
      op: { type: 'start' as const, at: '2026-11-25T15:20:00.000Z' },
      message: 'Project is archived',
    };
    const notice = refusedTimeNotice([STOP, second], { timerStopped: true });
    expect(notice.body).toContain(`${formatRefusedAt(second.op.at)} — Project is archived`);
    expect(notice.body.indexOf(STOP.message)).toBeLessThan(
      notice.body.indexOf(second.message),
    );
  });
});
