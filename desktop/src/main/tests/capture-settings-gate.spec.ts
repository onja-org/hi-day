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
      appUrlTracking: 'off',
      allowedApps: 'all',
      screenshotsEnabled: false,
      screenshotFrequencySeconds: 0,
      // Matches OFF_SETTINGS' own default — see capture-settings-gate.ts's
      // comment on it. Informational only now (drives the disclosure
      // banner), never gates capture.
      consent: { required: true },
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

  it('calls onChange again when only appUrlTracking changes', async () => {
    const onChange = vi.fn();
    let value = settings({ appUrlTracking: 'apps_urls' });
    const gate = new CaptureSettingsGate(
      makeSession('token-1'),
      { getCaptureSettings: () => Promise.resolve({ ok: true, data: value }) },
      onChange,
    );

    await gate.pollOnce();
    value = settings({ appUrlTracking: 'off' });
    await gate.pollOnce();

    expect(onChange).toHaveBeenLastCalledWith(settings({ appUrlTracking: 'off' }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('calls onChange again when only allowedApps changes', async () => {
    const onChange = vi.fn();
    let value = settings({ allowedApps: 'all' });
    const gate = new CaptureSettingsGate(
      makeSession('token-1'),
      { getCaptureSettings: () => Promise.resolve({ ok: true, data: value }) },
      onChange,
    );

    await gate.pollOnce();
    value = settings({ allowedApps: 'mobile_only' });
    await gate.pollOnce();

    expect(onChange).toHaveBeenLastCalledWith(
      settings({ allowedApps: 'mobile_only' }),
    );
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

  it('calls onChange again on a consent.required transition', async () => {
    const onChange = vi.fn();
    let required = true;
    const client: CaptureSettingsClient = {
      getCaptureSettings: vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          data: settings({
            windowTrackingEnabled: true,
            consent: { required },
          }),
        }),
      ),
    };
    const gate = new CaptureSettingsGate(makeSession('token-1'), client, onChange);

    await gate.pollOnce();
    expect(onChange).toHaveBeenCalledWith(
      settings({ windowTrackingEnabled: true, consent: { required: true } }),
    );

    required = false;
    await gate.pollOnce();
    expect(onChange).toHaveBeenLastCalledWith(
      settings({ windowTrackingEnabled: true, consent: { required: false } }),
    );
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('keeps the last known settings through a failed request', async () => {
    const onChange = vi.fn();
    const client = makeClient({ ok: true, data: settings({ windowTrackingEnabled: true, appUrlTracking: 'apps_urls' }) });
    const gate = new CaptureSettingsGate(makeSession('token-1'), client, onChange);
    await gate.pollOnce();

    (client.getCaptureSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    await gate.pollOnce();

    expect(onChange).toHaveBeenCalledTimes(1); // only the first, enabling poll
  });

  it('treats a signed-out device (401) as all-off', async () => {
    const onChange = vi.fn();
    const client = makeClient({ ok: true, data: settings({ windowTrackingEnabled: true, appUrlTracking: 'apps' }) });
    const gate = new CaptureSettingsGate(makeSession('token-1'), client, onChange);
    await gate.pollOnce();

    (client.getCaptureSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      unauthorized: true,
    });
    await gate.pollOnce();

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ appUrlTracking: 'off', windowTrackingEnabled: false }),
    );
  });
});
