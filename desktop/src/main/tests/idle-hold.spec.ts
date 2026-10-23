import { describe, expect, it } from 'vitest';
import {
  awaySeconds,
  decideOnReturn,
  discardStartedAt,
  keepStartedAt,
  type IdleHold,
  type IdleHoldPolicy,
} from '../../renderer/idle-hold';

const IDLE_START = '2026-10-23T09:00:00.000Z';
const minutesAfterStart = (minutes: number): string =>
  new Date(Date.parse(IDLE_START) + minutes * 60_000).toISOString();

function hold(overrides: Partial<IdleHold> = {}): IdleHold {
  return {
    projectId: 'project-1',
    taskId: 'task-1',
    idleStartedAt: IDLE_START,
    returnedAt: null,
    reason: 'sleep',
    ...overrides,
  };
}

const flag = (thresholdMinutes: number): IdleHoldPolicy => ({ handling: 'flag', thresholdMinutes });

describe('decideOnReturn — waking from sleep', () => {
  // The bug: GNOME suspends a laptop after 15 min on battery, the agent
  // ended the entry on suspend, and nothing started it again on wake.
  it.each([
    { threshold: 20, awayMinutes: 17, expected: 'resume' },
    { threshold: 20, awayMinutes: 19.9, expected: 'resume' },
    { threshold: 20, awayMinutes: 20, expected: 'ask' },
    { threshold: 20, awayMinutes: 600, expected: 'ask' },
    { threshold: 5, awayMinutes: 4, expected: 'resume' },
    { threshold: 5, awayMinutes: 6, expected: 'ask' },
  ])(
    'with a $threshold min timeout, $awayMinutes min away → $expected',
    ({ threshold, awayMinutes, expected }) => {
      const returnedAt = minutesAfterStart(awayMinutes);
      const decision = decideOnReturn(hold({ returnedAt }), flag(threshold), Date.parse(returnedAt));
      expect(decision.kind).toBe(expected);
    },
  );

  it('picks up from where input stopped when back before the timeout, so no time is lost', () => {
    const returnedAt = minutesAfterStart(17);
    expect(decideOnReturn(hold({ returnedAt }), flag(20), Date.parse(returnedAt))).toEqual({
      kind: 'resume',
      startedAt: IDLE_START,
    });
  });

  it('drops the idle time and stays stopped past the timeout under auto_subtract', () => {
    const returnedAt = minutesAfterStart(30);
    const decision = decideOnReturn(
      hold({ returnedAt }),
      { handling: 'auto_subtract', thresholdMinutes: 20 },
      Date.parse(returnedAt),
    );
    expect(decision).toEqual({ kind: 'stay-stopped' });
  });

  it('still resumes a short sleep under auto_subtract', () => {
    const returnedAt = minutesAfterStart(3);
    const decision = decideOnReturn(
      hold({ returnedAt }),
      { handling: 'auto_subtract', thresholdMinutes: 20 },
      Date.parse(returnedAt),
    );
    expect(decision.kind).toBe('resume');
  });
});

describe('decideOnReturn — the timeout reached while the app watched', () => {
  it('always asks, whatever the clock says', () => {
    const decision = decideOnReturn(
      hold({ reason: 'timeout', returnedAt: minutesAfterStart(1) }),
      flag(20),
      Date.parse(minutesAfterStart(1)),
    );
    expect(decision.kind).toBe('ask');
  });
});

describe('Keep and Discard', () => {
  it('Keep starts again from when input stopped, so the idle stretch counts', () => {
    expect(keepStartedAt(hold({ returnedAt: minutesAfterStart(25) }))).toBe(IDLE_START);
  });

  it('Discard starts again from when the person came back, dropping only the idle stretch', () => {
    const returnedAt = minutesAfterStart(25);
    expect(discardStartedAt(hold({ returnedAt }), minutesAfterStart(40))).toBe(returnedAt);
  });

  it('Discard starts from now when the return was never seen', () => {
    expect(discardStartedAt(hold(), minutesAfterStart(40))).toBe(minutesAfterStart(40));
  });

  it('never counts the idle stretch twice or loses the time either side of it', () => {
    const returnedAt = minutesAfterStart(25);
    const answeredAt = minutesAfterStart(40);
    const h = hold({ returnedAt });
    // Entry one ends at idleStartedAt; entry two starts at the chosen time.
    const keptGap = Date.parse(keepStartedAt(h)) - Date.parse(h.idleStartedAt);
    const discardedGap = Date.parse(discardStartedAt(h, answeredAt)) - Date.parse(h.idleStartedAt);
    expect(keptGap).toBe(0);
    expect(discardedGap).toBe(25 * 60_000);
  });
});

describe('awaySeconds', () => {
  it('measures to the return, or to now while still away', () => {
    expect(awaySeconds(hold({ returnedAt: minutesAfterStart(2) }), Date.parse(minutesAfterStart(9)))).toBe(120);
    expect(awaySeconds(hold(), Date.parse(minutesAfterStart(9)))).toBe(540);
  });
});
