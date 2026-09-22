import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadRelaunchHistory,
  pruneToWindow,
  recordRelaunch,
  shouldRelaunch,
} from '../crash-recovery';

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
