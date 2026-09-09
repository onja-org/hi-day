export interface HeartbeatSchedulerOptions {
  /** How often to re-resolve while active — configurable per Prompt B.1. */
  intervalMs?: number;
  onTick: () => void;
}

const DEFAULT_INTERVAL_MS = 5_000;

/**
 * Drives "re-resolve every N seconds while a browser is frontmost, paused
 * otherwise" — this lives on the Electron side, not inside any platform
 * resolver side-car, because the pinned protocol (CLAUDE.md) has no
 * mechanism for a side-car to push a fresh URL unprompted: only `resolve`/
 * `ping` requests and `focus`/`ready`/`error` events exist. So "heartbeat"
 * has to mean "the consumer of ResolverManager's `focus` events calls
 * resolve() on a timer" — this class is that timer, decoupled from any one
 * platform so a future Windows/Linux resolver needs no new heartbeat logic
 * of its own.
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
