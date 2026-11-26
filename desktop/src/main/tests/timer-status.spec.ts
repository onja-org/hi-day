import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntry } from '../api-client';
import { PendingTimerOps } from '../pending-timer-ops';
import { readTimerStatus } from '../timer-status';

const offline = { ok: false as const, message: 'Could not reach the server' };
const offlineClient = {
  pauseTimer: vi.fn(() => Promise.resolve(offline)),
  stopTimer: vi.fn(() => Promise.resolve(offline)),
  startTimer: vi.fn(() => Promise.resolve(offline)),
  switchTimer: vi.fn(() => Promise.resolve(offline)),
} as never;

// Reads succeeding while queued writes don't — a server answering GETs as it
// comes back, or a backoff after a 503 — told the app "nothing is running"
// while its own start was still waiting to be sent, and the timer vanished.
describe('readTimerStatus', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'timer-status-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function statusOf(ops: PendingTimerOps, fromServer: () => Promise<unknown>) {
    return readTimerStatus({
      settleQueue: () => Promise.resolve(),
      hasPending: () => ops.hasPending(),
      fromServer: fromServer as () => Promise<{ ok: true; data: { entry: TimeEntry | null } }>,
      fromLocal: () => ({ entry: ops.current() }),
    });
  }

  it('keeps a timer whose start is still queued, whatever the server says', async () => {
    const ops = new PendingTimerOps(dir);
    await ops.start('t', 'p1', null, offlineClient);
    const fromServer = vi.fn(() => Promise.resolve({ ok: true, data: { entry: null } }));

    const status = await statusOf(ops, fromServer);

    expect(fromServer).not.toHaveBeenCalled();
    expect(status).toEqual({
      ok: true,
      data: { entry: expect.objectContaining({ projectId: 'p1' }) as unknown },
      fromCache: true,
    });
    expect(ops.current()?.projectId).toBe('p1');
  });

  it('asks the server once nothing is waiting', async () => {
    const ops = new PendingTimerOps(dir);
    const answer = { ok: true, data: { entry: null } };
    const fromServer = vi.fn(() => Promise.resolve(answer));

    expect(await statusOf(ops, fromServer)).toBe(answer);
  });

  it('settles the queue before deciding', async () => {
    const order: string[] = [];
    await readTimerStatus({
      settleQueue: () => {
        order.push('settle');
        return Promise.resolve();
      },
      hasPending: () => {
        order.push('check');
        return false;
      },
      fromServer: () => {
        order.push('server');
        return Promise.resolve({ ok: true as const, data: {} });
      },
      fromLocal: () => ({}),
    });

    expect(order).toEqual(['settle', 'check', 'server']);
  });
});
