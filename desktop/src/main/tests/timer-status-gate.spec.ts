import { describe, expect, it, vi } from 'vitest';
import type { TimerStatusClient, TimerStatusSession } from '../timer-status-gate';
import { TimerStatusGate } from '../timer-status-gate';

describe('TimerStatusGate', () => {
  function makeSession(deviceToken: string | null): TimerStatusSession {
    return { load: () => (deviceToken ? { deviceToken } : null) };
  }

  type Result =
    | { ok: true; data: { entry: { pausedAt?: string | null } | null } }
    | { ok: false; unauthorized?: boolean };

  function makeClient(result: Result): TimerStatusClient {
    return { getCurrentTimer: vi.fn().mockResolvedValue(result) };
  }

  /** One result per poll, so a transition can be driven across polls. */
  function makeSequenceClient(...results: Result[]): TimerStatusClient {
    const getCurrentTimer = vi.fn();
    for (const result of results) getCurrentTimer.mockResolvedValueOnce(result);
    return { getCurrentTimer };
  }

  it('does not call onChange when there is no session and it was already not running', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession(null),
      makeClient({ ok: true, data: { entry: {} } }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange(true) once a running entry is reported', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeClient({ ok: true, data: { entry: {} } }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('treats a null entry as not running', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeClient({ ok: true, data: { entry: null } }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange again when the value has not changed', async () => {
    const onChange = vi.fn();
    const client = makeClient({ ok: true, data: { entry: {} } });
    const gate = new TimerStatusGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    await gate.pollOnce();
    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange(false) once the entry stops (a real transition)', async () => {
    const onChange = vi.fn();
    let entry: { pausedAt?: string | null } | null = {};
    const client: TimerStatusClient = {
      getCurrentTimer: vi.fn().mockImplementation(() =>
        Promise.resolve({ ok: true, data: { entry } }),
      ),
    };
    const gate = new TimerStatusGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    expect(onChange).toHaveBeenCalledWith(true);

    entry = null;
    await gate.pollOnce();
    expect(onChange).toHaveBeenLastCalledWith(false);

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('treats a paused entry as not running', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeClient({ ok: true, data: { entry: { pausedAt: '2026-09-17T00:00:00Z' } } }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange(false) when a running entry is paused, then onChange(true) on resume', async () => {
    const onChange = vi.fn();
    let entry: { pausedAt?: string | null } = { pausedAt: null };
    const client: TimerStatusClient = {
      getCurrentTimer: vi.fn().mockImplementation(() =>
        Promise.resolve({ ok: true, data: { entry } }),
      ),
    };
    const gate = new TimerStatusGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    expect(onChange).toHaveBeenLastCalledWith(true);

    entry = { pausedAt: '2026-09-17T00:00:00Z' };
    await gate.pollOnce();
    expect(onChange).toHaveBeenLastCalledWith(false);

    entry = { pausedAt: null };
    await gate.pollOnce();
    expect(onChange).toHaveBeenLastCalledWith(true);

    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('leaves a stopped timer stopped when the request fails', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeClient({ ok: false }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled();
  });

  // The offline regression: going offline used to report the running timer
  // as stopped, which stops the window sampler, the activity ticker and URL
  // capture — all while the time entry keeps running.
  it('holds a running timer through an unreachable server', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeSequenceClient(
        { ok: true, data: { entry: {} } },
        { ok: false },
        { ok: false },
      ),
      onChange,
    );

    await gate.pollOnce();
    await gate.pollOnce();
    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reports the stop that happened while offline, once the server answers again', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeSequenceClient(
        { ok: true, data: { entry: {} } },
        { ok: false },
        { ok: true, data: { entry: null } },
      ),
      onChange,
    );

    await gate.pollOnce();
    await gate.pollOnce();
    await gate.pollOnce();

    expect(onChange).toHaveBeenNthCalledWith(1, true);
    expect(onChange).toHaveBeenNthCalledWith(2, false);
  });

  // A revoked session is an answer, unlike an unreachable server.
  it('reports not running when the device session is revoked', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeSequenceClient(
        { ok: true, data: { entry: {} } },
        { ok: false, unauthorized: true },
      ),
      onChange,
    );

    await gate.pollOnce();
    await gate.pollOnce();

    expect(onChange).toHaveBeenNthCalledWith(2, false);
  });

  // An older server omitting `entry` used to throw on `.pausedAt`.
  it('treats a missing entry field as not running rather than throwing', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeClient({ ok: true, data: {} as { entry: null } }),
      onChange,
    );

    await expect(gate.pollOnce()).resolves.toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });
});
