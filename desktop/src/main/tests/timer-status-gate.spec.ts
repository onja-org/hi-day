import { describe, expect, it, vi } from 'vitest';
import type { TimerStatusClient, TimerStatusSession } from '../timer-status-gate';
import { TimerStatusGate } from '../timer-status-gate';

describe('TimerStatusGate', () => {
  function makeSession(deviceToken: string | null): TimerStatusSession {
    return { load: () => (deviceToken ? { deviceToken } : null) };
  }

  function makeClient(
    result: { ok: true; data: { entry: unknown } } | { ok: false },
  ): TimerStatusClient {
    return { getCurrentTimer: vi.fn().mockResolvedValue(result) };
  }

  it('does not call onChange when there is no session and it was already not running', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession(null),
      makeClient({ ok: true, data: { entry: { id: 'entry-1' } } }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange(true) once a running entry is reported', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeClient({ ok: true, data: { entry: { id: 'entry-1' } } }),
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
    const client = makeClient({ ok: true, data: { entry: { id: 'entry-1' } } });
    const gate = new TimerStatusGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    await gate.pollOnce();
    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange(false) once the entry stops (a real transition)', async () => {
    const onChange = vi.fn();
    let entry: unknown = { id: 'entry-1' };
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

  it('treats a failed request as not running', async () => {
    const onChange = vi.fn();
    const gate = new TimerStatusGate(
      makeSession('token-1'),
      makeClient({ ok: false }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled(); // starts false; a failed poll stays false
  });
});
