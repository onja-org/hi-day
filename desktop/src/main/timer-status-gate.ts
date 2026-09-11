export interface TimerStatusSession {
  load(): { deviceToken: string } | null;
}

export interface TimerStatusResult {
  ok: boolean;
  data?: { entry: unknown };
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
    this.applyIfChanged(running);
  }

  private async isCurrentlyRunning(deviceToken: string): Promise<boolean> {
    const result = await this.apiClient.getCurrentTimer(deviceToken);
    if (!result.ok || !result.data) return false;
    return result.data.entry !== null;
  }

  private applyIfChanged(running: boolean): void {
    if (running === this.lastRunning) return;
    this.lastRunning = running;
    this.onChange(running);
  }
}
