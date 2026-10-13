import type { AllowedApps, AppUrlTracking } from "./api-client";

export interface CaptureSettingsSession {
  load(): { deviceToken: string } | null;
}

export interface CaptureSettingsValue {
  windowTrackingEnabled: boolean;
  appUrlTracking: AppUrlTracking;
  allowedApps: AllowedApps;
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
  appUrlTracking: "off",
  // `all`, not a restriction: with no session there is nothing to track
  // anyway, and claiming the admin forbade it would be a lie.
  allowedApps: "all",
  screenshotsEnabled: false,
  screenshotFrequencySeconds: 0,
  consent: { required: true },
};

export interface CaptureSettingsResult {
  ok: boolean;
  data?: CaptureSettingsValue;
  /** The device was signed out — an answer, unlike a request that failed. */
  unauthorized?: boolean;
}

export interface CaptureSettingsClient {
  getCaptureSettings(deviceToken: string): Promise<CaptureSettingsResult>;
}

/** Matches TimerStatusGate's, so a setting change and the stopped timer it
 * causes land together rather than seconds apart. */
export const DEFAULT_CAPTURE_SETTINGS_POLL_INTERVAL_MS = 15_000;

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
    if (settings) this.applyIfChanged(settings);
  }

  /**
   * `null` when the request didn't get an answer (offline, a server error,
   * a deploy): the last known settings stand, rather than one missed poll
   * switching capture off — and URL capture with it, losing its open
   * session. A sign-out is an answer, and it means off.
   */
  private async currentSettings(
    deviceToken: string,
  ): Promise<CaptureSettingsValue | null> {
    const result = await this.apiClient.getCaptureSettings(deviceToken);
    if (result.ok && result.data) return result.data;
    if (result.unauthorized) return OFF_SETTINGS;
    return null;
  }

  private applyIfChanged(settings: CaptureSettingsValue): void {
    if (
      settings.windowTrackingEnabled === this.lastSettings.windowTrackingEnabled &&
      settings.appUrlTracking === this.lastSettings.appUrlTracking &&
      settings.allowedApps === this.lastSettings.allowedApps &&
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
