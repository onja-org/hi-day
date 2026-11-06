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
    expect(startTimer).toHaveBeenCalledWith(
      't',
      'p2',
      null,
      '2026-10-09T09:00:00.000Z',
      expect.any(String),
    );

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

  // The running entry lived in memory, so a relaunch with no connection
  // told somebody watching a ticking clock that nothing was running.
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

  // Everywhere else a poll or the crash prompt reconciles what was left
  // half-done. Here the process is about to stop existing.
  describe('ending the timer durably, for a process about to die', () => {
    it('writes the stop down before it asks the server anything', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);
      let queuedWhenAsked: unknown;
      const pauseTimer = vi.fn(() => {
        // What is on disk at the moment the network call begins — which
        // is the moment a shutdown is most likely to kill us.
        queuedWhenAsked = new PendingTimerOps(dir).load();
        return Promise.resolve(ok);
      });

      await ops.pauseDurably('t', client({ pauseTimer }));

      expect(queuedWhenAsked).toEqual([
        {
          type: 'stop',
          at: expect.any(String) as string,
          opId: expect.any(String) as string,
        },
      ]);
    });

    it('ends the entry where input stopped when given a time, as a stop the server can backdate', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);
      const stopTimer = vi.fn(() => Promise.resolve(ok));
      const pauseTimer = vi.fn();
      let queuedWhenAsked: unknown;
      stopTimer.mockImplementation(() => {
        queuedWhenAsked = new PendingTimerOps(dir).load();
        return Promise.resolve(ok);
      });

      await ops.pauseDurably('t', client({ stopTimer, pauseTimer }), '2026-10-23T09:00:00.000Z');

      expect(pauseTimer).not.toHaveBeenCalled();
      expect(stopTimer).toHaveBeenCalledWith('t', '2026-10-23T09:00:00.000Z', expect.any(String));
      expect(queuedWhenAsked).toEqual([
        { type: 'stop', at: '2026-10-23T09:00:00.000Z', opId: expect.any(String) as string },
      ]);
    });

    it('leaves nothing behind once the server has taken it', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);

      await ops.pauseDurably('t', client({ pauseTimer: () => Promise.resolve(ok) }));

      // The record had one job and it is done; replaying it would end
      // whatever entry comes next.
      expect(new PendingTimerOps(dir).load()).toEqual([]);
    });

    it('keeps the stop when the server cannot be reached', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);

      const result = await ops.pauseDurably('t', client());

      expect(result.ok && result.data.endedAt).toBeTruthy();
      expect(new PendingTimerOps(dir).load()).toHaveLength(1);
    });

    it('replays what was already waiting first, rather than closing the wrong entry', async () => {
      const store = diskBackedStore();
      const ops = new PendingTimerOps(dir, store);
      await ops.start('t', 'p2', null, client());
      const pauseTimer = vi.fn();

      await ops.pauseDurably('t', client({ pauseTimer }));

      // A lone pause here would act on whatever the server still thinks
      // is running, which is not the entry this device started offline.
      expect(pauseTimer).not.toHaveBeenCalled();
      expect(ops.load().map((op) => op.type)).toEqual(['start', 'stop']);
    });

    it('asks the server when nothing is known to be running here', async () => {
      // The one case the old unconditional call existed for: an entry the
      // server holds that this device never saw start.
      const pauseTimer = vi.fn(() => Promise.resolve(ok));

      await new PendingTimerOps(dir, diskBackedStore()).pauseDurably(
        't',
        client({ pauseTimer }),
      );

      expect(pauseTimer).toHaveBeenCalled();
    });

    it('survives being killed between writing and sending', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);

      // The process dies mid-request: no response, nothing cleaned up.
      await ops
        .pauseDurably(
          't',
          client({ pauseTimer: () => Promise.reject(new Error('killed')) }),
        )
        .catch(() => {});

      // A brand new process finds the stop waiting, at the time it really
      // happened — not an entry still running through the night.
      const afterReboot = new PendingTimerOps(dir, diskBackedStore());
      expect(afterReboot.load()).toHaveLength(1);
      expect(afterReboot.load()[0].type).toBe('stop');
    });
  });

  // Main measures staleness from the last real answer, so a queued one
  // must not look like one — or a device unreachable for a fortnight
  // reports itself in touch every time play is pressed.
  describe('an answer the queue made up', () => {
    it('marks an offline start as not having come from the server', async () => {
      const result = await new PendingTimerOps(dir).start(
        't',
        'p2',
        null,
        client(),
      );

      expect(result.ok && result.fromCache).toBe(true);
    });

    it('marks an offline stop the same way', async () => {
      const ops = new PendingTimerOps(dir);
      ops.remember(entry);

      const result = await ops.pause('t', client());

      expect(result.ok && result.fromCache).toBe(true);
    });

    it('leaves a real answer unmarked', async () => {
      const result = await new PendingTimerOps(dir).start(
        't',
        'p2',
        null,
        client({ startTimer: () => Promise.resolve(ok) }),
      );

      expect(result.ok && result.fromCache).toBeUndefined();
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

    it('says nothing about a sign-out, and keeps the hours for the login that follows', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());
      const signedOut = { ...offline, status: 401, unauthorized: true };

      const result = await ops.flush(
        't',
        client({ startTimer: () => Promise.resolve(signedOut) }),
      );

      // A revoked session is not a verdict on the work. Dropping the queue
      // here wiped a day's tracking with no message at all.
      expect(result.refused).toEqual([]);
      expect(result.signedOut).toBe(true);
      expect(result.settled).toBe(false);
      expect(ops.load()).toHaveLength(1);
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

  // The bug this file's `serverVerdict` split exists for: a replay used to
  // leave the queue on *any* HTTP status, so reconnecting into a deploy,
  // an overloaded minute or a revoked session deleted real hours.
  describe('hours the server has not decided about', () => {
    const unavailable = { ...offline, status: 503, message: 'Service Unavailable' };

    it('keeps a start the server was too busy to answer, and replays it after', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());
      const queued = ops.load();

      const first = await ops.flush('t', client({ startTimer: () => Promise.resolve(unavailable) }));

      expect(first.settled).toBe(false);
      expect(first.refused).toEqual([]);
      expect(ops.load()).toEqual(queued);

      // Past the wait, with the deploy finished.
      ops.retryNow();
      const startTimer = vi.fn(() => Promise.resolve(ok));
      expect((await ops.flush('t', client({ startTimer }))).settled).toBe(true);
      expect(startTimer).toHaveBeenCalledWith('t', 'p2', null, (queued[0] as { at: string }).at, expect.any(String));
    });

    it('keeps the stop paired to a start the server could not answer', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());
      await ops.pause('t', client());

      await ops.flush('t', client({ startTimer: () => Promise.resolve(unavailable) }));

      // Dropping the start used to take its stop with it — correct for a
      // refusal, catastrophic for a blip.
      expect(ops.load().map((op) => op.type)).toEqual(['start', 'stop']);
    });

    it('keeps a stop whose start already landed, rather than leaving the entry open for ever', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());
      await ops.pause('t', client());

      const result = await ops.flush(
        't',
        client({
          startTimer: () => Promise.resolve(ok),
          stopTimer: () => Promise.resolve(unavailable),
        }),
      );

      expect(result.settled).toBe(false);
      expect(ops.load().map((op) => op.type)).toEqual(['stop']);
    });

    it('keeps an op a proxy answered with something nobody recognises', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());

      await ops.flush('t', client({ startTimer: () => Promise.resolve({ ...offline, status: 451 }) }));

      expect(ops.load()).toHaveLength(1);
    });

    it('still drops and reports a work-time limit, which is a real answer', async () => {
      const ops = new PendingTimerOps(dir);
      await ops.start('t', 'p2', null, client());
      const limit = {
        ...offline,
        status: 403,
        message: 'You have reached your daily limit of 8 hours.',
      };

      const result = await ops.flush('t', client({ startTimer: () => Promise.resolve(limit) }));

      // 403 is not in the ticket's suggested drop list; leaving it out
      // would have this retry for ever and the queue never drain.
      expect(result.settled).toBe(true);
      expect(result.refused).toEqual([
        { op: expect.objectContaining({ type: 'start' }) as unknown, message: limit.message },
      ]);
      expect(ops.load()).toEqual([]);
    });
  });

  describe('leaving a struggling server alone', () => {
    const unavailable = { ...offline, status: 503, message: 'Service Unavailable' };
    let clock: number;
    const options = () => ({ now: () => clock, random: () => 0 });

    beforeEach(() => {
      clock = 1_000_000;
    });

    it('does not ask again until the backoff has elapsed', async () => {
      const ops = new PendingTimerOps(dir, undefined, options());
      await ops.start('t', 'p2', null, client());
      await ops.flush('t', client({ startTimer: () => Promise.resolve(unavailable) }));

      const startTimer = vi.fn(() => Promise.resolve(ok));
      clock += 15_000; // the next replay tick
      expect((await ops.flush('t', client({ startTimer }))).settled).toBe(false);
      expect(startTimer).not.toHaveBeenCalled();

      clock += 30_000;
      expect((await ops.flush('t', client({ startTimer }))).settled).toBe(true);
      expect(startTimer).toHaveBeenCalledTimes(1);
    });

    it('backs off further each time it is told to wait', async () => {
      const ops = new PendingTimerOps(dir, undefined, { now: () => clock, random: () => 1 });
      await ops.start('t', 'p2', null, client());
      const busy = client({ startTimer: () => Promise.resolve(unavailable) });

      await ops.flush('t', busy); // 30s
      clock += 30_000;
      await ops.flush('t', busy); // doubles to 60s at full jitter
      clock += 30_000;

      const startTimer = vi.fn(() => Promise.resolve(ok));
      await ops.flush('t', client({ startTimer }));
      // A flat delay would have been due by now; the doubled one is not.
      expect(startTimer).not.toHaveBeenCalled();
    });

    it('forgets the wait as soon as something lands', async () => {
      // Full jitter, so a second consecutive failure would wait 60s and a
      // reset one waits 30s — the difference this is checking.
      const ops = new PendingTimerOps(dir, undefined, { now: () => clock, random: () => 1 });
      await ops.start('t', 'p2', null, client());
      await ops.pause('t', client());
      await ops.flush('t', client({ startTimer: () => Promise.resolve(unavailable) }));
      clock += 30_000;

      // The start lands, the stop is refused again: the wait restarts from
      // the bottom rather than carrying the first failure's exponent.
      await ops.flush(
        't',
        client({
          startTimer: () => Promise.resolve(ok),
          stopTimer: () => Promise.resolve(unavailable),
        }),
      );

      const stopTimer = vi.fn(() => Promise.resolve(ok));
      clock += 30_000;
      expect((await ops.flush('t', client({ stopTimer }))).settled).toBe(true);
    });

    it('waits for no server that never answered — that is an outage, not a refusal', async () => {
      const ops = new PendingTimerOps(dir, undefined, options());
      await ops.start('t', 'p2', null, client());
      await ops.flush('t', client());

      // Quick retries are the only thing that notices a reconnection.
      const startTimer = vi.fn(() => Promise.resolve(ok));
      expect((await ops.flush('t', client({ startTimer }))).settled).toBe(true);
    });

    it('tries once more when somebody presses Quit', async () => {
      const ops = new PendingTimerOps(dir, undefined, options());
      await ops.start('t', 'p2', null, client());
      await ops.flush('t', client({ startTimer: () => Promise.resolve(unavailable) }));

      expect(ops.isDue()).toBe(false);
      ops.retryNow();
      const startTimer = vi.fn(() => Promise.resolve(ok));
      await ops.flush('t', client({ startTimer }));
      expect(startTimer).toHaveBeenCalled();
    });
  });


  // The same rule, applied to the click itself rather than its replay:
  // a 503 on Play used to surface as an error and lose the start outright.
  describe('a click the server could not answer', () => {
    it('queues a start the server was too busy for', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());

      const result = await ops.start(
        't',
        'p2',
        null,
        client({ startTimer: () => Promise.resolve({ ...offline, status: 503 }) }),
      );

      expect(result.ok && result.fromCache).toBe(true);
      expect(ops.load()).toHaveLength(1);
    });

    it('still surfaces a refusal the person has to see', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());

      const result = await ops.start(
        't',
        'p2',
        null,
        client({
          startTimer: () =>
            Promise.resolve({ ...offline, status: 409, message: 'A timer is already running on this device.' }),
        }),
      );

      expect(result.ok).toBe(false);
      expect(ops.load()).toEqual([]);
    });

    it('refuses to start a clock for a session that is already gone', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      await ops.start('t', 'p2', null, client());

      const signedOut = { ...offline, status: 401, unauthorized: true };
      const result = await ops.start('t', 'p3', null, client({ startTimer: () => Promise.resolve(signedOut) }));

      // Queueing it would tick in front of somebody whose hours can never
      // land; `unauthorized` is what makes main sign out instead.
      expect(result.ok).toBe(false);
      expect(!result.ok && result.unauthorized).toBe(true);
      expect(ops.load()).toHaveLength(1);
    });
  });

  // A request that times out after the server applied it used to come back
  // as "time could not be saved", because the queued copy was given a new
  // name and the server could not recognise it as the same operation.
  describe('an answer that never arrived', () => {
    /** What a 5s `REQUEST_TIMEOUT_MS` abort looks like: no status at all. */
    const timedOut = () => Promise.resolve(offline);

    it('queues a start under the id the first attempt already sent', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      const startTimer = vi.fn(timedOut);

      await ops.start('t', 'p2', null, client({ startTimer }));

      const sent = (startTimer.mock.calls[0] as unknown[])[4] as string;
      expect(sent).toEqual(expect.any(String));
      expect((ops.load()[0] as { opId: string }).opId).toBe(sent);
    });

    it('queues a pause under the id the first attempt already sent', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);
      const pauseTimer = vi.fn(timedOut);

      await ops.pause('t', client({ pauseTimer }));

      const sent = (pauseTimer.mock.calls[0] as unknown[])[1] as string;
      expect(sent).toEqual(expect.any(String));
      expect((ops.load()[0] as { opId: string }).opId).toBe(sent);
    });

    it('queues an idle stop under the id the first attempt already sent', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);
      const stopTimer = vi.fn(timedOut);

      await ops.stopAt('t', client({ stopTimer }), '2026-10-09T09:30:00.000Z');

      const sent = (stopTimer.mock.calls[0] as unknown[])[2] as string;
      expect(sent).toEqual(expect.any(String));
      expect((ops.load()[0] as { opId: string }).opId).toBe(sent);
    });

    it('names the write-ahead pause, which is the one that cannot be retried', async () => {
      // `pauseDurably` runs while the OS is already shutting the machine
      // down — the likeliest moment of all for a reply not to arrive.
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);
      const pauseTimer = vi.fn(timedOut);

      await ops.pauseDurably('t', client({ pauseTimer }));

      expect((pauseTimer.mock.calls[0] as unknown[])[1]).toBe(
        (ops.load()[0] as { opId: string }).opId,
      );
    });

    it('sends the switch under the ids its queued halves will carry', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);
      const switchTimer = vi.fn(timedOut);

      await ops.switchTo('t', 'p2', null, client({ switchTimer }));

      // A switch writes two rows, so recognising a replay of it takes two
      // ids — and they have to be the ones the first attempt sent, or the
      // queued stop meets the entry the switch just started and is refused.
      const [, , , sentStop, sentStart] = switchTimer.mock.calls[0] as unknown[];
      const [stop, start] = ops.load() as { opId: string }[];
      expect(sentStop).toBe(stop.opId);
      expect(sentStart).toBe(start.opId);
    });

    it('replays the whole switch under the ids its own halves were queued with', async () => {
      const ops = new PendingTimerOps(dir, diskBackedStore());
      ops.remember(entry);
      await ops.switchTo('t', 'p2', null, client());
      const [stop, start] = ops.load() as { opId: string }[];

      const stopTimer = vi.fn(() => Promise.resolve({ ...ok, data: { ...entry, endedAt: '2026-10-09T09:00:00.000Z' } }));
      const startTimer = vi.fn(() => Promise.resolve(ok));
      await ops.flush('t', client({ stopTimer, startTimer }));

      expect((stopTimer.mock.calls[0] as unknown[])[2]).toBe(stop.opId);
      expect((startTimer.mock.calls[0] as unknown[])[4]).toBe(start.opId);
    });
  });
});
