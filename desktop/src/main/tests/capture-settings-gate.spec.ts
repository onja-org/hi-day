import { describe, expect, it, vi } from 'vitest';
import type {
  CaptureSettingsClient,
  CaptureSettingsSession,
} from '../capture-settings-gate';
import { CaptureSettingsGate } from '../capture-settings-gate';

describe('CaptureSettingsGate', () => {
  function makeSession(deviceToken: string | null): CaptureSettingsSession {
    return { load: () => (deviceToken ? { deviceToken } : null) };
  }

  function makeClient(
    result: { ok: true; data: { windowTrackingEnabled: boolean } } | { ok: false },
  ): CaptureSettingsClient {
    return { getCaptureSettings: vi.fn().mockResolvedValue(result) };
  }

  it('does not call onChange when there is no session and it was already off', async () => {
    const onChange = vi.fn();
    const gate = new CaptureSettingsGate(
      makeSession(null),
      makeClient({ ok: true, data: { windowTrackingEnabled: true } }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange(false) once logged out mid-session (a real transition)', async () => {
    const onChange = vi.fn();
    let session: { deviceToken: string } | null = { deviceToken: 'token-1' };
    const gate = new CaptureSettingsGate(
      { load: () => session },
      makeClient({ ok: true, data: { windowTrackingEnabled: true } }),
      onChange,
    );

    await gate.pollOnce();
    expect(onChange).toHaveBeenCalledWith(true);

    session = null;
    await gate.pollOnce();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('calls onChange(true) once the backend reports the flag enabled', async () => {
    const onChange = vi.fn();
    const gate = new CaptureSettingsGate(
      makeSession('token-1'),
      makeClient({ ok: true, data: { windowTrackingEnabled: true } }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange again when the value has not changed', async () => {
    const onChange = vi.fn();
    const client = makeClient({ ok: true, data: { windowTrackingEnabled: true } });
    const gate = new CaptureSettingsGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    await gate.pollOnce();
    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange again on an actual transition', async () => {
    const onChange = vi.fn();
    let enabled = false;
    const client: CaptureSettingsClient = {
      getCaptureSettings: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ ok: true, data: { windowTrackingEnabled: enabled } }),
        ),
    };
    const gate = new CaptureSettingsGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    expect(onChange).not.toHaveBeenCalled();

    enabled = true;
    await gate.pollOnce();
    expect(onChange).toHaveBeenCalledWith(true);

    enabled = false;
    await gate.pollOnce();
    expect(onChange).toHaveBeenCalledWith(false);

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('treats a failed request as disabled', async () => {
    const onChange = vi.fn();
    const gate = new CaptureSettingsGate(
      makeSession('token-1'),
      makeClient({ ok: false }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled(); // starts false; a failed poll stays false
  });
});
