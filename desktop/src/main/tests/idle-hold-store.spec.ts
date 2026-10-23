import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IdleHoldStore, whenInputStopped, type IdleHold } from '../idle-hold-store';

const HOLD: IdleHold = {
  projectId: 'project-1',
  taskId: null,
  idleStartedAt: '2026-10-23T09:00:00.000Z',
  returnedAt: null,
  reason: 'sleep',
};

describe('IdleHoldStore', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idle-hold-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('survives a new instance — a relaunch must not lose the question', () => {
    new IdleHoldStore(dir).save(HOLD);
    expect(new IdleHoldStore(dir).load()).toEqual(HOLD);
  });

  it('records the return once and never moves it', () => {
    const store = new IdleHoldStore(dir);
    store.save(HOLD);
    store.markReturned('2026-10-23T09:17:00.000Z');
    store.markReturned('2026-10-23T09:30:00.000Z');
    expect(store.load()?.returnedAt).toBe('2026-10-23T09:17:00.000Z');
  });

  it('has nothing to mark, or load, once cleared', () => {
    const store = new IdleHoldStore(dir);
    store.save(HOLD);
    store.clear();
    expect(store.load()).toBeNull();
    expect(store.markReturned('2026-10-23T09:17:00.000Z')).toBeNull();
  });

  it('reads a torn file as no hold', () => {
    writeFileSync(join(dir, 'idle-hold.json'), '{"projectId":');
    expect(new IdleHoldStore(dir).load()).toBeNull();
  });
});

describe('whenInputStopped', () => {
  const now = Date.parse('2026-10-23T09:15:00.000Z');

  it('counts back from a fresh reading — a laptop that suspended itself after 15 idle minutes', () => {
    const reading = { seconds: 14 * 60 + 50, atMs: now - 10_000 };
    expect(new Date(whenInputStopped(reading, now)).toISOString()).toBe('2026-10-23T09:00:00.000Z');
  });

  it('falls back to now with no reading, or a stale one', () => {
    expect(whenInputStopped(null, now)).toBe(now);
    expect(whenInputStopped({ seconds: 600, atMs: now - 2 * 60_000 }, now)).toBe(now);
  });

  it('never lands in the future', () => {
    expect(whenInputStopped({ seconds: 0, atMs: now + 5_000 }, now)).toBe(now);
  });
});
