import { describe, expect, it, vi } from 'vitest';
import type {
  CaptureSettingsClient,
  CaptureSettingsSession,
  CaptureSettingsValue,
} from '../capture-settings-gate';
import { CaptureSettingsGate } from '../capture-settings-gate';

describe('CaptureSettingsGate', () => {
  function settings(
    overrides: Partial<CaptureSettingsValue> = {},
  ): CaptureSettingsValue {
    return {
      windowTrackingEnabled: false,
      screenshotsEnabled: false,
      screenshotFrequencySeconds: 0,
      ...overrides,
    };
  }

  function makeSession(deviceToken: string | null): CaptureSettingsSession {
    return { load: () => (deviceToken ? { deviceToken } : null) };
  }

  function makeClient(
    result: { ok: true; data: CaptureSettingsValue } | { ok: false },
  ): CaptureSettingsClient {
    return { getCaptureSettings: vi.fn().mockResolvedValue(result) };
  }

  it('does not call onChange when there is no session and it was already off', async () => {
    const onChange = vi.fn();
    const gate = new CaptureSettingsGate(
      makeSession(null),
      makeClient({ ok: true, data: settings({ windowTrackingEnabled: true }) }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange with all-off once logged out mid-session (a real transition)', async () => {
    const onChange = vi.fn();
    let session: { deviceToken: string } | null = { deviceToken: 'token-1' };
    const gate = new CaptureSettingsGate(
      { load: () => session },
      makeClient({ ok: true, data: settings({ windowTrackingEnabled: true }) }),
      onChange,
    );

    await gate.pollOnce();
    expect(onChange).toHaveBeenCalledWith(settings({ windowTrackingEnabled: true }));

    session = null;
    await gate.pollOnce();
    expect(onChange).toHaveBeenLastCalledWith(settings());
  });

  it('calls onChange once the backend reports window tracking enabled', async () => {
    const onChange = vi.fn();
    const gate = new CaptureSettingsGate(
      makeSession('token-1'),
      makeClient({ ok: true, data: settings({ windowTrackingEnabled: true }) }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledWith(settings({ windowTrackingEnabled: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange again when nothing has changed', async () => {
    const onChange = vi.fn();
    const client = makeClient({
      ok: true,
      data: settings({ windowTrackingEnabled: true }),
    });
    const gate = new CaptureSettingsGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    await gate.pollOnce();
    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange again when only screenshotFrequencySeconds changes', async () => {
    const onChange = vi.fn();
    let frequency = 600;
    const client: CaptureSettingsClient = {
      getCaptureSettings: vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          data: settings({
            screenshotsEnabled: true,
            screenshotFrequencySeconds: frequency,
          }),
        }),
      ),
    };
    const gate = new CaptureSettingsGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    expect(onChange).toHaveBeenCalledTimes(1);

    frequency = 120;
    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(
      settings({ screenshotsEnabled: true, screenshotFrequencySeconds: 120 }),
    );
  });

  it('calls onChange again on an actual on/off transition', async () => {
    const onChange = vi.fn();
    let enabled = false;
    const client: CaptureSettingsClient = {
      getCaptureSettings: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve({
            ok: true,
            data: settings({ windowTrackingEnabled: enabled }),
          }),
        ),
    };
    const gate = new CaptureSettingsGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    expect(onChange).not.toHaveBeenCalled();

    enabled = true;
    await gate.pollOnce();
    expect(onChange).toHaveBeenCalledWith(settings({ windowTrackingEnabled: true }));

    enabled = false;
    await gate.pollOnce();
    expect(onChange).toHaveBeenCalledWith(settings());

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('treats a failed request as all-off', async () => {
    const onChange = vi.fn();
    const gate = new CaptureSettingsGate(
      makeSession('token-1'),
      makeClient({ ok: false }),
      onChange,
    );

    await gate.pollOnce();

    expect(onChange).not.toHaveBeenCalled(); // starts all-off; a failed poll stays all-off
  });
});
