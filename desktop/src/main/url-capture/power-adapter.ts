import type { EngineClock, EngineEvent } from './session-types';

export type PowerMonitorEventName = 'suspend' | 'resume' | 'lock-screen' | 'unlock-screen' | 'shutdown';

/**
 * Hand-written rather than derived from Electron's own (overloaded, many
 * more event names) `PowerMonitor` type — deliberately so this file has zero
 * dependency, type or runtime, on the 'electron' package. That's what lets
 * it run under vitest (plain Node, no Electron runtime) with a plain fake in
 * tests. The real `powerMonitor` singleton, wired in only by main.ts,
 * trivially satisfies this narrower shape.
 */
export interface MinimalPowerMonitor {
  getSystemIdleTime(): number;
  on(event: PowerMonitorEventName, listener: () => void): void;
  off(event: PowerMonitorEventName, listener: () => void): void;
}

export interface PowerAdapterOptions {
  idleThresholdMs?: number;
  idlePollIntervalMs?: number;
  /** Injected — the adapter reads real time; tests control it directly. */
  clock: () => EngineClock;
  onEvent: (event: EngineEvent) => void;
}

const DEFAULT_IDLE_THRESHOLD_MS = 120_000;
const DEFAULT_IDLE_POLL_INTERVAL_MS = 5_000;

/**
 * Translates Electron's powerMonitor into the session engine's event stream.
 * Keeps the engine pure — this is the adapter, not the engine (see
 * docs/url-tracking-plan.md Step 4). It has no opinion about timer state,
 * focus, or URLs; it only ever reports power/idle facts.
 */
export class PowerAdapter {
  private readonly idleThresholdMs: number;
  private readonly idlePollIntervalMs: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastIdleSeconds = 0;
  private isIdle = false;

  private readonly handleSuspend = (): void => {
    this.options.onEvent({ type: 'powerStateChanged', awake: false, ...this.options.clock() });
  };
  private readonly handleResume = (): void => {
    this.options.onEvent({ type: 'powerStateChanged', awake: true, ...this.options.clock() });
  };
  private readonly handleLock = (): void => {
    this.options.onEvent({ type: 'screenLockChanged', locked: true, ...this.options.clock() });
  };
  private readonly handleUnlock = (): void => {
    this.options.onEvent({ type: 'screenLockChanged', locked: false, ...this.options.clock() });
  };
  private readonly handleShutdown = (): void => {
    this.options.onEvent({ type: 'timerStateChanged', running: false, ...this.options.clock() });
  };

  constructor(
    private readonly powerMonitor: MinimalPowerMonitor,
    private readonly options: PowerAdapterOptions,
  ) {
    this.idleThresholdMs = options.idleThresholdMs ?? DEFAULT_IDLE_THRESHOLD_MS;
    this.idlePollIntervalMs = options.idlePollIntervalMs ?? DEFAULT_IDLE_POLL_INTERVAL_MS;
  }

  start(): void {
    this.powerMonitor.on('suspend', this.handleSuspend);
    this.powerMonitor.on('resume', this.handleResume);
    this.powerMonitor.on('lock-screen', this.handleLock);
    this.powerMonitor.on('unlock-screen', this.handleUnlock);
    this.powerMonitor.on('shutdown', this.handleShutdown);
    this.pollTimer = setInterval(() => this.pollIdle(), this.idlePollIntervalMs);
  }

  stop(): void {
    this.powerMonitor.off('suspend', this.handleSuspend);
    this.powerMonitor.off('resume', this.handleResume);
    this.powerMonitor.off('lock-screen', this.handleLock);
    this.powerMonitor.off('unlock-screen', this.handleUnlock);
    this.powerMonitor.off('shutdown', this.handleShutdown);
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Exposed for tests — production code just calls start() and lets the timer drive this. */
  pollIdle(): void {
    const idleSeconds = this.powerMonitor.getSystemIdleTime();
    const thresholdSeconds = this.idleThresholdMs / 1000;

    if (this.isIdle && idleSeconds < this.lastIdleSeconds) {
      this.isIdle = false;
      this.options.onEvent({ type: 'idleChanged', idle: false, ...this.options.clock() });
    } else if (!this.isIdle && idleSeconds >= thresholdSeconds) {
      this.isIdle = true;
      this.options.onEvent({ type: 'idleChanged', idle: true, ...this.options.clock() });
    }

    this.lastIdleSeconds = idleSeconds;
  }
}
