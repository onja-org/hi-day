import { describe, expect, it } from 'vitest';
import {
  bootIdentity,
  isSameBoot,
  shouldAutoStart,
  type AutoStartInput,
} from '../auto-start';

function input(overrides: Partial<AutoStartInput> = {}): AutoStartInput {
  return {
    enabled: true,
    boot: 'id:9f2c',
    lastAutoStartedBoot: null,
    signedIn: true,
    timerRunning: false,
    awaitingIdleAnswer: false,
    awaitingRecoveredAnswer: false,
    ...overrides,
  };
}

describe('shouldAutoStart', () => {
  it('starts on a power-on it has not started for', () => {
    expect(shouldAutoStart(input())).toBe(true);
  });

  it('does nothing until the preference is turned on', () => {
    expect(shouldAutoStart(input({ enabled: false }))).toBe(false);
  });

  it('starts only once for a power-on, however often the app launches', () => {
    expect(shouldAutoStart(input({ lastAutoStartedBoot: 'id:9f2c' }))).toBe(false);
    // A crash relaunch or an update restart is the same machine, still on.
    expect(shouldAutoStart(input({ lastAutoStartedBoot: 'id:earlier' }))).toBe(true);
  });

  it('stays out of the way of a timer that is already running', () => {
    expect(shouldAutoStart(input({ timerRunning: true }))).toBe(false);
  });

  it('leaves an unanswered idle question to be answered first', () => {
    expect(shouldAutoStart(input({ awaitingIdleAnswer: true }))).toBe(false);
  });

  it('leaves a crash-recovered timer to be answered first', () => {
    expect(shouldAutoStart(input({ awaitingRecoveredAnswer: true }))).toBe(false);
  });

  it('has nothing to start while signed out', () => {
    expect(shouldAutoStart(input({ signedIn: false }))).toBe(false);
  });

  it('refuses rather than guesses when power-ons cannot be told apart', () => {
    expect(shouldAutoStart(input({ boot: null }))).toBe(false);
  });
});

describe('bootIdentity', () => {
  it('prefers the id the kernel publishes, which a suspend does not change', () => {
    expect(bootIdentity({ readBootId: () => 'f1d2-3c4b\n' })).toBe('id:f1d2-3c4b');
  });

  it('works the boot time out from the clock where there is no such id', () => {
    const identity = bootIdentity({
      readBootId: () => {
        throw new Error('ENOENT');
      },
      uptimeSeconds: () => 3_600,
      nowMs: () => 10_000_000,
    });
    expect(identity).toBe(`at:${10_000_000 - 3_600_000}`);
  });

  it('answers nothing rather than nonsense when neither can be read', () => {
    expect(
      bootIdentity({
        readBootId: () => '',
        uptimeSeconds: () => Number.NaN,
      }),
    ).toBeNull();
  });
});

describe('isSameBoot', () => {
  it('has nothing to compare the first time', () => {
    expect(isSameBoot('id:a', null)).toBe(false);
  });

  it('treats kernel ids as exact', () => {
    expect(isSameBoot('id:a', 'id:a')).toBe(true);
    expect(isSameBoot('id:a', 'id:b')).toBe(false);
  });

  it('absorbs the wobble in a computed boot time', () => {
    // Seconds apart: the same machine, read twice.
    expect(isSameBoot('at:1000000', 'at:1002000')).toBe(true);
    // An hour apart: it was turned off and on again.
    expect(isSameBoot('at:1000000', 'at:4600000')).toBe(false);
  });

  it('never calls a computed time the same boot as a kernel id', () => {
    expect(isSameBoot('at:1000000', 'id:a')).toBe(false);
  });
});
