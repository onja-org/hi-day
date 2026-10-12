import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntry } from '../api-client';
import { PendingTimerOps } from '../pending-timer-ops';

const entry: TimeEntry = {
  id: 'e1',
  projectId: 'p1',
  taskId: null,
  startedAt: '2026-10-09T08:00:00.000Z',
  endedAt: null,
  pausedAt: null,
  pausedSeconds: 0,
};
const offline = { ok: false as const, message: 'Could not reach the server' };
const ok = { ok: true as const, data: entry };

function client(overrides: Record<string, unknown> = {}) {
  return {
    pauseTimer: vi.fn(() => Promise.resolve(offline)),
    stopTimer: vi.fn(() => Promise.resolve(offline)),
    startTimer: vi.fn(() => Promise.resolve(offline)),
    switchTimer: vi.fn(() => Promise.resolve(offline)),
    ...overrides,
  } as never;
}

describe('PendingTimerOps', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pending-ops-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('pauses offline: reports the entry ended and queues a stop', async () => {
    const ops = new PendingTimerOps(dir);
    ops.remember(entry);

    const result = await ops.pause('t', client());

    expect(result.ok && result.data.endedAt).toBeTruthy();
    expect(new PendingTimerOps(dir).load()).toEqual([
      { type: 'stop', at: expect.any(String) as string },
    ]);
  });

  it('does not treat a server rejection as offline', async () => {
    const ops = new PendingTimerOps(dir);
    ops.remember(entry);
    const rejected = { ...offline, status: 404 };

    const result = await ops.pause('t', client({ pauseTimer: () => Promise.resolve(rejected) }));

    expect(result.ok).toBe(false);
    expect(ops.load()).toEqual([]);
  });

  it('starts offline with a local running entry and replays the original time', async () => {
    const ops = new PendingTimerOps(dir);

    const started = await ops.start('t', 'p2', 'task', client());
    expect(started.ok && started.data.endedAt).toBeNull();
    const [op] = ops.load();
    expect(op).toMatchObject({ type: 'start', projectId: 'p2', taskId: 'task' });

    const startTimer = vi.fn(() => Promise.resolve(ok));
    expect(await ops.flush('t', client({ startTimer }))).toBe(true);
    expect(startTimer).toHaveBeenCalledWith('t', 'p2', 'task', (op as { at: string }).at);
    expect(ops.load()).toEqual([]);
  });

  it('queues a pause pressed after an offline start behind it, in order', async () => {
    const ops = new PendingTimerOps(dir);
    await ops.start('t', 'p2', null, client());
    await ops.pause('t', client());

    expect(ops.load().map((op) => op.type)).toEqual(['start', 'stop']);
  });

  it('switches offline as a stop and a start at the same instant', async () => {
    const ops = new PendingTimerOps(dir);
    ops.remember(entry);

    await ops.switchTo('t', 'p2', null, client());

    const [stop, start] = ops.load();
    expect(stop.type).toBe('stop');
    expect(start).toMatchObject({ type: 'start', projectId: 'p2', at: stop.at });
  });

  it('keeps ops while still offline and drops a rejected start with its stop', async () => {
    const ops = new PendingTimerOps(dir);
    await ops.start('t', 'p2', null, client());
    await ops.pause('t', client());

    expect(await ops.flush('t', client())).toBe(false);
    expect(ops.load()).toHaveLength(2);

    const rejected = { ...offline, status: 409 };
    const stopTimer = vi.fn();
    expect(
      await ops.flush('t', client({ startTimer: () => Promise.resolve(rejected), stopTimer })),
    ).toBe(true);
    expect(stopTimer).not.toHaveBeenCalled();
  });
});
