import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntry } from '../api-client';
import {
  createFatalErrorHandler,
  loadRelaunchHistory,
  pruneToWindow,
  recordRelaunch,
  shouldRelaunch,
} from '../crash-recovery';
import { OfflineCache } from '../offline-cache';
import { recoveryActionFor } from '../recovered-timer';

describe('pruneToWindow', () => {
  it('drops timestamps older than the window', () => {
    expect(pruneToWindow([0, 40_000, 55_000], 60_000, 60_000)).toEqual([40_000, 55_000]);
  });

  it('keeps everything inside the window', () => {
    expect(pruneToWindow([10_000, 20_000], 25_000, 60_000)).toEqual([10_000, 20_000]);
  });
});

describe('shouldRelaunch', () => {
  it('is true with no prior relaunches', () => {
    expect(shouldRelaunch([], 100_000)).toBe(true);
  });

  it('is true while under the ceiling within the window', () => {
    expect(shouldRelaunch([90_000, 95_000], 100_000)).toBe(true);
  });

  it('is false once the ceiling is hit within the window', () => {
    expect(shouldRelaunch([70_000, 80_000, 90_000], 100_000)).toBe(false);
  });

  it('ignores relaunches that have aged out of the window', () => {
    expect(shouldRelaunch([0, 1_000, 2_000], 100_000)).toBe(true);
  });

  it('honors custom window/ceiling overrides', () => {
    expect(
      shouldRelaunch([95_000], 100_000, { windowMs: 10_000, maxRelaunches: 1 }),
    ).toBe(false);
  });
});

describe('loadRelaunchHistory / recordRelaunch', () => {
  let userDataDir: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-crash-recovery-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('returns an empty history when nothing has been recorded yet', () => {
    expect(loadRelaunchHistory(userDataDir)).toEqual([]);
  });

  it('persists a recorded relaunch across loads', () => {
    recordRelaunch(userDataDir, 1_000);
    expect(loadRelaunchHistory(userDataDir)).toEqual([1_000]);
  });

  it('accumulates relaunches and prunes ones outside the window on record', () => {
    recordRelaunch(userDataDir, 0, 60_000);
    recordRelaunch(userDataDir, 30_000, 60_000);
    recordRelaunch(userDataDir, 70_000, 60_000);

    expect(loadRelaunchHistory(userDataDir)).toEqual([30_000, 70_000]);
  });

  it('tolerates a corrupt history file by treating it as empty', () => {
    writeFileSync(join(userDataDir, 'crash-relaunch-history.json'), 'not json');
    expect(loadRelaunchHistory(userDataDir)).toEqual([]);
  });
});

describe('createFatalErrorHandler', () => {
  let userDataDir: string;
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'desktop-fatal-error-'));
  });
  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  function handlerAt(nowMs: number) {
    const deps = {
      userDataDir: () => userDataDir,
      now: () => nowMs,
      log: vi.fn(),
      relaunch: vi.fn(),
      exit: vi.fn(),
    };
    return { handle: createFatalErrorHandler(deps), deps };
  }

  it('records the crash, relaunches, then exits', () => {
    const { handle, deps } = handlerAt(100_000);

    handle('exception', new Error('Bad window'));

    expect(loadRelaunchHistory(userDataDir)).toEqual([100_000]);
    expect(deps.relaunch).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledWith(1);
    expect(deps.relaunch.mock.invocationCallOrder[0]).toBeLessThan(
      deps.exit.mock.invocationCallOrder[0],
    );
  });

  // One X11 race emitted two errors (the title read and the WM_CLASS read)
  // before the process went down. Counting both used up the crash-loop
  // allowance twice as fast: two real crashes in a minute and the app gave
  // up relaunching altogether.
  it('acts once per process: a second error on the way down is only logged', () => {
    const { handle, deps } = handlerAt(100_000);

    handle('exception', new Error('Bad window'));
    handle('exception', new Error('Bad window'));

    expect(deps.log).toHaveBeenCalledTimes(2);
    expect(loadRelaunchHistory(userDataDir)).toEqual([100_000]);
    expect(deps.relaunch).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledTimes(1);
  });

  it('exits without relaunching once crashes loop', () => {
    writeFileSync(
      join(userDataDir, 'crash-relaunch-history.json'),
      JSON.stringify([70_000, 80_000, 90_000]),
    );
    const { handle, deps } = handlerAt(100_000);

    handle('rejection', new Error('boom'));

    expect(deps.relaunch).not.toHaveBeenCalled();
    expect(deps.exit).toHaveBeenCalledWith(1);
  });

  // The reported bug's second half: the handler used to pause the running
  // timer before relaunching, which cleared it locally, so the relaunch had
  // nothing to recover and tracking silently stayed stopped. ADR-0025's
  // recovery is what decides a crashed timer's fate.
  it('leaves a running timer for crash recovery to carry on after a quick relaunch', () => {
    const crashAt = Date.parse('2026-11-25T09:00:10.000Z');
    const cache = new OfflineCache(userDataDir, () => new Date('2026-11-25T09:00:00.000Z'));
    const running: TimeEntry = {
      id: 'entry-1',
      projectId: 'project-1',
      taskId: null,
      startedAt: '2026-11-25T08:00:00.000Z',
      endedAt: null,
      pausedAt: null,
      pausedSeconds: 0,
    };
    cache.rememberRunning(running);
    const { handle } = handlerAt(crashAt);

    handle('exception', new Error('Bad window'));

    const afterRelaunch = new OfflineCache(userDataDir).read();
    expect(afterRelaunch.runningEntry).toEqual(running);
    const silentForMs = crashAt + 3_000 - Date.parse(afterRelaunch.runningSeenAt!);
    expect(recoveryActionFor(silentForMs)).toBe('keep');
  });
});
