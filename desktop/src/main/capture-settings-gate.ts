export interface CaptureSettingsSession {
  load(): { deviceToken: string } | null;
}

export interface CaptureSettingsResult {
  ok: boolean;
  data?: { windowTrackingEnabled: boolean };
}

export interface CaptureSettingsClient {
  getCaptureSettings(deviceToken: string): Promise<CaptureSettingsResult>;
}

export const DEFAULT_CAPTURE_SETTINGS_POLL_INTERVAL_MS = 30_000;

/**
 * Polls `/device/capture-settings` from the main process and calls
 * `onChange` only when the effective on/off value actually changes — lets
 * WindowSampler.start()/stop() be driven idempotently. Also invoked
 * on-demand (via `pollOnce`) right after login/logout, so tracking follows
 * session state immediately rather than waiting for the next tick.
 *
 * Deliberately independent of the renderer's own status-poll interval
 * (STATUS_POLL_INTERVAL_MS in renderer.ts) — this is a main-process-only
 * concern, since starting/stopping the sampler has nothing to do with
 * what's rendered.
 */
export class CaptureSettingsGate {
  private handle: ReturnType<typeof setInterval> | null = null;
  private lastEnabled = false;

  constructor(
    private readonly authStore: CaptureSettingsSession,
    private readonly apiClient: CaptureSettingsClient,
    private readonly onChange: (enabled: boolean) => void,
    private readonly pollIntervalMs = DEFAULT_CAPTURE_SETTINGS_POLL_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.handle) return;
    void this.pollOnce();
    this.handle = setInterval(() => void this.pollOnce(), this.pollIntervalMs);
  }

  stop(): void {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }

  async pollOnce(): Promise<void> {
    const session = this.authStore.load();
    const enabled = session ? await this.currentEnabled(session.deviceToken) : false;
    this.applyIfChanged(enabled);
  }

  private async currentEnabled(deviceToken: string): Promise<boolean> {
    const result = await this.apiClient.getCaptureSettings(deviceToken);
    return result.ok ? (result.data?.windowTrackingEnabled ?? false) : false;
  }

  private applyIfChanged(enabled: boolean): void {
    if (enabled === this.lastEnabled) return;
    this.lastEnabled = enabled;
    this.onChange(enabled);
  }
}
