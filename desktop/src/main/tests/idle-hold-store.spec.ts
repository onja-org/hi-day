import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IdleHoldStore, type IdleHold } from '../idle-hold-store';

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
