export interface HeartbeatSchedulerOptions {
  /** How often to re-resolve while active — configurable per Prompt B.1. */
  intervalMs?: number;
  onTick: () => void;
}

const DEFAULT_INTERVAL_MS = 5_000;

/**
 * Re-resolves every N seconds while a browser is frontmost, paused
 * otherwise. Lives here rather than in a side-car because the pinned
 * protocol has no way for one to push a URL unprompted, and is
 * platform-agnostic so no resolver needs its own copy.
 */
export class HeartbeatScheduler {
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: HeartbeatSchedulerOptions) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  }

  /** Call whenever focus changes: true once landed on a recognized browser, false otherwise. */
  setActive(active: boolean): void {
    if (active && !this.timer) {
      this.timer = setInterval(() => this.options.onTick(), this.intervalMs);
    } else if (!active && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get isActive(): boolean {
    return this.timer !== null;
  }

  stop(): void {
    this.setActive(false);
  }
}
