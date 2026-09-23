export interface CaptureSettingsSession {
  load(): { deviceToken: string } | null;
}

export interface CaptureSettingsValue {
  windowTrackingEnabled: boolean;
  screenshotsEnabled: boolean;
  /** How often to capture a screenshot, in seconds — meaningless while `screenshotsEnabled` is false. */
  screenshotFrequencySeconds: number;
  /** See docs/adr/0015-... — purely informational, drives the renderer's passive disclosure banner. Never gates capture. Same shape as ApiClient's own CaptureSettings.consent, so a real API result needs no mapping here. */
  consent: { required: boolean };
}

// consent.required defaults true (not false, unlike every other field here):
// with no session/settings loaded yet, showing the disclosure banner is the
// safer default until the gate actually confirms it isn't needed — this no
// longer blocks anything, it just decides whether the banner renders.
const OFF_SETTINGS: CaptureSettingsValue = {
  windowTrackingEnabled: false,
  screenshotsEnabled: false,
  screenshotFrequencySeconds: 0,
  consent: { required: true },
};

export interface CaptureSettingsResult {
  ok: boolean;
  data?: CaptureSettingsValue;
}

export interface CaptureSettingsClient {
  getCaptureSettings(deviceToken: string): Promise<CaptureSettingsResult>;
}

export const DEFAULT_CAPTURE_SETTINGS_POLL_INTERVAL_MS = 30_000;

/**
 * Polls `/device/capture-settings` from the main process and calls
 * `onChange` with the full settings object, but only when it actually
 * differs from the last poll — lets WindowSampler.start()/stop() and
 * ScreenshotSampler.start()/stop()/setIntervalMs() be driven idempotently
 * off one shared poll, rather than each capture module polling the same
 * endpoint independently (see docs/adr/0012-...). Also invoked on-demand
 * (via `pollOnce`) right after login/logout, so tracking follows session
 * state immediately rather than waiting for the next tick.
 *
 * Deliberately independent of the renderer's own status-poll interval
 * (STATUS_POLL_INTERVAL_MS in renderer.ts) — this is a main-process-only
 * concern, since starting/stopping a sampler has nothing to do with what's
 * rendered.
 */
export class CaptureSettingsGate {
  private handle: ReturnType<typeof setInterval> | null = null;
  private lastSettings: CaptureSettingsValue = OFF_SETTINGS;

  constructor(
    private readonly authStore: CaptureSettingsSession,
    private readonly apiClient: CaptureSettingsClient,
    private readonly onChange: (settings: CaptureSettingsValue) => void,
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
    const settings = session
      ? await this.currentSettings(session.deviceToken)
      : OFF_SETTINGS;
    this.applyIfChanged(settings);
  }

  private async currentSettings(
    deviceToken: string,
  ): Promise<CaptureSettingsValue> {
    const result = await this.apiClient.getCaptureSettings(deviceToken);
    return result.ok && result.data ? result.data : OFF_SETTINGS;
  }

  private applyIfChanged(settings: CaptureSettingsValue): void {
    if (
      settings.windowTrackingEnabled === this.lastSettings.windowTrackingEnabled &&
      settings.screenshotsEnabled === this.lastSettings.screenshotsEnabled &&
      settings.screenshotFrequencySeconds ===
        this.lastSettings.screenshotFrequencySeconds &&
      settings.consent.required === this.lastSettings.consent.required
    ) {
      return;
    }
    this.lastSettings = settings;
    this.onChange(settings);
  }
}
