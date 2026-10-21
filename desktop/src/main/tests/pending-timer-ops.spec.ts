import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeEntry } from '../api-client';
import { PendingTimerOps } from '../pending-timer-ops';
import type { RunningEntryStore } from '../pending-timer-ops';

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

/** Stands in for the offline cache: a running entry that outlives the process. */
function diskBackedStore(): RunningEntryStore {
  let held: TimeEntry | null = null;
  return {
    read: () => held,
    write: (next) => {
      held = next;
    },
  };
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
      {
        type: 'stop',
        at: expect.any(String) as string,
        opId: expect.any(String) as string,
      },
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
    expect((await ops.flush('t', client({ startTimer }))).settled).toBe(true);
    expect(startTimer).toHaveBeenCalledWith(
      't',
      'p2',
      'task',
      (op as { at: string }).at,
      (op as { opId: string }).opId,
    );
    expect(ops.load()).toEqual([]);
  });

  it('passes a backdated start to the server and queues it with that time offline', async () => {
    const startTimer = vi.fn(() => Promise.resolve(ok));
    await new PendingTimerOps(dir).start('t', 'p2', null, client({ startTimer }), '2026-10-09T09:00:00.000Z');
    expect(startTimer).toHaveBeenCalledWith('t', 'p2', null, '2026-10-09T09:00:00.000Z');

    const ops = new PendingTimerOps(dir);
    await ops.start('t', 'p2', null, client(), '2026-10-09T09:00:00.000Z');
    expect(ops.load()).toEqual([
      {
        type: 'start',
        at: '2026-10-09T09:00:00.000Z',
        projectId: 'p2',
        taskId: null,
        opId: expect.any(String) as string,
      },
    ]);
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

    expect((await ops.flush('t', client())).settled).toBe(false);
    expect(ops.load()).toHaveLength(2);

    const rejected = { ...offline, status: 409 };
    const stopTimer = vi.fn();
    expect(
      (
        await ops.flush(
          't',
          client({ startTimer: () => Promise.resolve(rejected), stopTimer }),
        )
      ).settled,
    ).toBe(true);
    expect(stopTimer).not.toHaveBeenCalled();
  });

  it('queues and replays a start that has no project', async () => {
    const ops = new PendingTimerOps(dir);

    const result = await ops.start('t', null, null, client());

    expect(result.ok && result.data.projectId).toBeNull();
    expect(new PendingTimerOps(dir).load()).toEqual([
      {
        type: 'start',
        at: expect.any(String) as string,
        projectId: null,
        taskId: null,
        opId: expect.any(String) as string,
      },
    ]);

    const startTimer = vi.fn(() => Promise.resolve(ok));
    await new PendingTimerOps(dir).flush('t', client({ startTimer }));

    expect(startTimer).toHaveBeenCalledWith(
      't',
      null,
      null,
      expect.any(String),
      expect.any(String),
    );
  });

  /**
   * The gap that made the whole offline path unusable across a restart:
   * the running entry lived in memory, so a relaunch with no connection
   * met somebody looking at a ticking clock and told them nothing was
   * running.
   */
  describe('the running entry across a restart', () => {
    it('can still stop a timer started offline before the app was restarted', async () => {
      const store = diskBackedStore();
      await new PendingTimerOps(dir, store).start('t', 'p2', null, client());

      // A brand new process, same store.
      const afterRestart = new PendingTimerOps(dir, store);
      const stopped = await afterRestart.pause('t', client());

      expect(stopped.ok && stopped.data.endedAt).toBeTruthy();
      expect(afterRestart.load().map((op) => op.type)).toEqual(['start', 'stop']);
    });

    it('answers that nothing is running when nothing is', async () => {
      const result = await new PendingTimerOps(dir, diskBackedStore()).pause(
        't',
        client(),
      );

      expect(result.ok).toBe(false);
    });

    it('records what the server says is running, so a later offline stop can end it', async () => {
      const store = diskBackedStore();
      const ops = new PendingTimerOps(dir, store);

      await ops.start('t', 'p2', null, client({ startTimer: () => Promise.resolve(ok) }));

      expect(store.read()).toEqual(entry);
    });
  });

  describe('operation ids', () => {
    it('keeps the same id across replays, so a resend is not a second start', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());
      const queued = (ops.load()[0] as { opId: string }).opId;

      // First replay dies on the way out; the second sends the same id.
      await ops.flush('t', client());
      const startTimer = vi.fn(() => Promise.resolve(ok));
      await ops.flush('t', client({ startTimer }));

      expect(startTimer).toHaveBeenCalledWith(
        't',
        'p2',
        null,
        expect.any(String),
        queued,
      );
    });

    it('gives the stop and start of a switch ids of their own', async () => {
      const ops = new PendingTimerOps(dir);
      ops.remember(entry);

      await ops.switchTo('t', 'p2', null, client());

      const [stop, start] = ops.load() as { opId: string }[];
      expect(stop.opId).not.toBe(start.opId);
    });
  });

  describe('hours the server refuses', () => {
    it('reports them, rather than dropping them where nobody will look', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());
      const refusal = {
        ...offline,
        status: 400,
        message: 'This start is more than 30 days old.',
      };

      const result = await ops.flush(
        't',
        client({ startTimer: () => Promise.resolve(refusal) }),
      );

      expect(result.settled).toBe(true);
      expect(result.refused).toEqual([
        {
          op: expect.objectContaining({ type: 'start' }) as unknown,
          message: 'This start is more than 30 days old.',
        },
      ]);
    });

    it('says nothing about a sign-out, which is not lost time', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());
      const signedOut = { ...offline, status: 401, unauthorized: true };

      const result = await ops.flush(
        't',
        client({ startTimer: () => Promise.resolve(signedOut) }),
      );

      expect(result.refused).toEqual([]);
    });

    it('reports nothing when everything lands', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());

      const result = await ops.flush(
        't',
        client({ startTimer: () => Promise.resolve(ok) }),
      );

      expect(result.refused).toEqual([]);
    });
  });
});
