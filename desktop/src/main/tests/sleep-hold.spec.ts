import { describe, expect, it } from 'vitest';
import { isRepeatSignal, sleepHoldOnWake } from '../sleep-hold';
import type { IdleHold } from '../idle-hold-store';

const SLEPT_AT = '2026-11-25T15:00:00.000Z';
const minutesAfter = (minutes: number): number =>
  Date.parse(SLEPT_AT) + minutes * 60_000;

const RUNNING_HOLD: IdleHold = {
  projectId: 'p1',
  taskId: null,
  idleStartedAt: SLEPT_AT,
  returnedAt: null,
  reason: 'sleep',
  timerRunning: true,
};
const FLAG = { handling: 'flag' as const, thresholdMinutes: 20 };

describe('sleepHoldOnWake', () => {
  it('leaves the timer running when back before the timeout', () => {
    expect(sleepHoldOnWake(RUNNING_HOLD, FLAG, minutesAfter(5))).toBe('carry-on');
    expect(sleepHoldOnWake(RUNNING_HOLD, FLAG, minutesAfter(19.9))).toBe('carry-on');
  });

  it('stops the timer once the time away reaches the timeout', () => {
    expect(sleepHoldOnWake(RUNNING_HOLD, FLAG, minutesAfter(20))).toBe('stop');
    expect(sleepHoldOnWake(RUNNING_HOLD, FLAG, minutesAfter(300))).toBe('stop');
  });

  it('stops under auto subtract too: the prompt is what differs, not the stop', () => {
    const autoSubtract = { handling: 'auto_subtract' as const, thresholdMinutes: 20 };
    expect(sleepHoldOnWake(RUNNING_HOLD, autoSubtract, minutesAfter(25))).toBe('stop');
    expect(sleepHoldOnWake(RUNNING_HOLD, autoSubtract, minutesAfter(5))).toBe('carry-on');
  });

  it('measures to the recorded return, not to whenever this runs', () => {
    const returned = { ...RUNNING_HOLD, returnedAt: new Date(minutesAfter(10)).toISOString() };
    expect(sleepHoldOnWake(returned, FLAG, minutesAfter(60))).toBe('carry-on');
  });

  it('stops when there is no policy left to measure against, so the prompt can ask', () => {
    expect(sleepHoldOnWake(RUNNING_HOLD, null, minutesAfter(1))).toBe('stop');
    const off = { handling: 'off' as const, thresholdMinutes: 20 };
    expect(sleepHoldOnWake(RUNNING_HOLD, off, minutesAfter(1))).toBe('stop');
  });

  it('leaves alone a hold whose timer was already stopped', () => {
    expect(sleepHoldOnWake(null, FLAG, minutesAfter(5))).toBe('none');
    const stopped = { ...RUNNING_HOLD, timerRunning: undefined };
    expect(sleepHoldOnWake(stopped, FLAG, minutesAfter(5))).toBe('none');
    const timeout = { ...RUNNING_HOLD, reason: 'timeout' as const, timerRunning: false };
    expect(sleepHoldOnWake(timeout, FLAG, minutesAfter(5))).toBe('none');
  });
});

describe('isRepeatSignal (sleep or wake reported twice)', () => {
  const woke = Date.parse('2026-11-25T15:20:00.000Z');

  it('treats a second wake signal within a few seconds as the same wake', () => {
    expect(isRepeatSignal(woke, woke + 1_500)).toBe(true);
  });

  it('treats a later one as a new wake', () => {
    expect(isRepeatSignal(woke, woke + 60_000)).toBe(false);
  });

  it('treats the first wake as new', () => {
    expect(isRepeatSignal(null, woke)).toBe(false);
  });
});
