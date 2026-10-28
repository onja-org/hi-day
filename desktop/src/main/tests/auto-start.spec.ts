import { describe, expect, it } from 'vitest';
import {
  bootIdentity,
  decideAutoStart,
  isSameBoot,
  parseWindowsBootId,
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

describe('decideAutoStart', () => {
  it('starts on a power-on it has not answered for', () => {
    expect(decideAutoStart(input())).toBe('start');
  });

  it('does nothing once the preference is turned off', () => {
    expect(decideAutoStart(input({ enabled: false }))).toBe('wait');
  });

  it('answers once for a power-on, however often the app launches', () => {
    expect(decideAutoStart(input({ lastAutoStartedBoot: 'id:9f2c' }))).toBe('wait');
    // A crash relaunch or an update restart is the same machine, still on.
    expect(decideAutoStart(input({ lastAutoStartedBoot: 'id:earlier' }))).toBe('start');
  });

  it('stays out of the way of a timer that is already running', () => {
    expect(decideAutoStart(input({ timerRunning: true }))).toBe('spend');
  });

  it('leaves an unanswered idle question to be answered first', () => {
    expect(decideAutoStart(input({ awaitingIdleAnswer: true }))).toBe('spend');
  });

  it('leaves a crash-recovered timer to be answered first', () => {
    expect(decideAutoStart(input({ awaitingRecoveredAnswer: true }))).toBe('spend');
  });

  // The whole of "whether logged in or not".
  it('waits for a sign-in rather than spending the power-on on nobody', () => {
    expect(decideAutoStart(input({ signedIn: false }))).toBe('wait');
  });

  it('does not re-offer a start that something else displaced', () => {
    const displaced = input({ awaitingIdleAnswer: true });
    expect(decideAutoStart(displaced)).toBe('spend');
    // Main stamps on anything but `wait`, so the next ask sees this:
    expect(
      decideAutoStart({ ...displaced, awaitingIdleAnswer: false, lastAutoStartedBoot: displaced.boot }),
    ).toBe('wait');
  });

  it('refuses rather than guesses when power-ons cannot be told apart', () => {
    expect(decideAutoStart(input({ boot: null }))).toBe('wait');
  });
});

describe('parseWindowsBootId', () => {
  it('takes the counter out of reg query output', () => {
    const output = [
      '',
      'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters',
      '    BootId    REG_DWORD    0x1f',
      '',
    ].join('\r\n');
    expect(parseWindowsBootId(output)).toBe('0x1f');
  });

  // A machine with prefetch disabled, or a Windows that stops writing it.
  it('answers nothing when the value is absent', () => {
    expect(parseWindowsBootId('ERROR: The system was unable to find')).toBeNull();
    expect(parseWindowsBootId('    BaseTime    REG_DWORD    0x1f')).toBeNull();
  });
});

describe('bootIdentity', () => {
  it('prefers the id the kernel publishes, which a suspend does not change', () => {
    expect(bootIdentity({ readBootId: () => 'f1d2-3c4b\n' })).toBe('id:f1d2-3c4b');
  });

  // Each platform has its own, and none of them is the clock: see
  // `readExactBootId` for why the computed form is a last resort.
  it('reads one on every platform that publishes one', () => {
    for (const platform of ['linux', 'darwin', 'win32'] as NodeJS.Platform[]) {
      expect(
        bootIdentity({ platform, readBootId: () => 'abc', uptimeSeconds: () => 1 }),
      ).toBe('id:abc');
    }
  });

  it('falls back to the clock where no platform id answers', () => {
    expect(
      bootIdentity({
        readBootId: () => null,
        uptimeSeconds: () => 60,
        nowMs: () => 1_000_000,
      }),
    ).toBe('at:940000');
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
