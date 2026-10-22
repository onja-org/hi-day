export interface TimerStatusSession {
  load(): { deviceToken: string } | null;
}

export interface TimerStatusResult {
  ok: boolean;
  data?: { entry: { pausedAt?: string | null } | null };
  /**
   * Set by DeviceSessionGuard for a missing, expired or admin-revoked
   * session, and never for a validation error or a transient failure. A
   * sign-out is an answer — see `isCurrentlyRunning`.
   */
  unauthorized?: boolean;
}

export interface TimerStatusClient {
  getCurrentTimer(deviceToken: string): Promise<TimerStatusResult>;
}

export const DEFAULT_TIMER_STATUS_POLL_INTERVAL_MS = 15_000;

/**
 * Polls `/device/time-entries/current` from the main process and calls
 * `onChange` only when "is a timer running at all" actually changes —
 * window tracking is meant to run only while the person is clocked in
 * (Hubstaff-style), not merely while logged in. Mirrors CaptureSettingsGate
 * one-for-one; kept as its own class rather than folded together, since
 * the two gate genuinely independent signals that both have to be true for
 * sampling to run (see main.ts's combined on/off decision).
 *
 * Polls independently rather than trusting only local start/stop/switch
 * clicks, because a running timer is server-authoritative (docs/adr/0006-...)
 * — it can be started/stopped from the web console or another device, not
 * just this app's own UI.
 */
export class TimerStatusGate {
  private handle: ReturnType<typeof setInterval> | null = null;
  private lastRunning = false;

  constructor(
    private readonly authStore: TimerStatusSession,
    private readonly apiClient: TimerStatusClient,
    private readonly onChange: (running: boolean) => void,
    private readonly pollIntervalMs = DEFAULT_TIMER_STATUS_POLL_INTERVAL_MS,
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
    const running = session ? await this.isCurrentlyRunning(session.deviceToken) : false;
    // `null` means the poll got no answer, so the last known state stands.
    if (running !== null) this.applyIfChanged(running);
  }

  /**
   * `null` when the request didn't get an answer (offline, a server error,
   * a deploy): the last known state stands, rather than one missed poll
   * reporting a running timer as stopped.
   *
   * This matters far beyond the tray icon. `onChange(false)` stops the
   * window sampler, clears the activity ticker and switches URL capture
   * off (see main.ts's recomputeSampling) — so treating an unreachable
   * server as "not running" silently halts every sampler while the time
   * entry keeps running. The person stays clocked in with no activity
   * recorded behind it, and the tray reads "not tracking" while the app's
   * own timer counts up. Same reasoning as CaptureSettingsGate's
   * `currentSettings`, which already holds its last value for this.
   *
   * A sign-out is an answer, and it means off.
   */
  private async isCurrentlyRunning(deviceToken: string): Promise<boolean | null> {
    const result = await this.apiClient.getCurrentTimer(deviceToken);
    // Before the `ok` check: an unauthorized result is also `ok: false`.
    if (result.unauthorized) return false;
    if (!result.ok || !result.data) return null;
    const entry = result.data.entry;
    // A manually paused entry still exists server-side (only stop() clears
    // it) — capture must not keep running through a pause, so treat it the
    // same as "no entry" here. Nullish, not `!== null`: an older server
    // omitting `entry` entirely would otherwise read as running and then
    // throw on `.pausedAt`, rejecting the poll.
    return entry != null && !entry.pausedAt;
  }

  private applyIfChanged(running: boolean): void {
    if (running === this.lastRunning) return;
    this.lastRunning = running;
    this.onChange(running);
  }
}
