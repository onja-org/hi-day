import type { ActivitySample, ActivitySampleSink } from './activity-sample';
import {
  DEFAULT_ACTIVITY_PERIOD_MS,
  computeActivePercentage,
  segmentIndexForOffset,
} from './activity-sample';

export type UnregisterInputListener = () => void;

interface UiohookLike {
  on(event: string, listener: () => void): void;
  off(event: string, listener: () => void): void;
  start(): void;
  stop(): void;
}

/**
 * Lazily requires `uiohook-napi` rather than a static `import` — a native
 * module failing to load/initialize should disable activity tracking, not
 * crash the agent. Tests always inject a fake (`ActivitySamplerDeps.registerInputListener`).
 */
function registerUiohookInputListener(onInput: () => void): UnregisterInputListener {
  let uIOhook: UiohookLike;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ uIOhook } = require('uiohook-napi') as { uIOhook: UiohookLike });
  } catch (error) {
    console.error(
      '[activity-sampler] uiohook-napi unavailable, activity level tracking disabled:',
      error,
    );
    return () => {};
  }

  const handler = () => onInput();
  const events = ['mousemove', 'mousedown', 'wheel', 'keydown'] as const;
  for (const event of events) uIOhook.on(event, handler);

  try {
    uIOhook.start();
  } catch (error) {
    console.error('[activity-sampler] failed to start uiohook-napi:', error);
    for (const event of events) uIOhook.off(event, handler);
    return () => {};
  }

  return () => {
    for (const event of events) uIOhook.off(event, handler);
    uIOhook.stop();
  };
}

export interface ActivitySamplerDeps {
  intervalMs?: number;
  sink?: ActivitySampleSink;
  now?: () => number;
  registerInputListener?: (onInput: () => void) => UnregisterInputListener;
}

/**
 * Gated on/off by `activityTrackingEnabled` + a running timer (main.ts's
 * `recomputeSampling`). Unlike WindowSampler/ScreenshotSampler there's no
 * per-tick sample — input accumulates into the current period's active
 * segments, and one ActivitySample is emitted per period boundary.
 */
export class ActivitySampler {
  private readonly intervalMs: number;
  private readonly sink: ActivitySampleSink;
  private readonly now: () => number;
  private readonly registerInputListener: (
    onInput: () => void,
  ) => UnregisterInputListener;

  private handle: ReturnType<typeof setInterval> | null = null;
  private unregisterInput: UnregisterInputListener | null = null;
  private activeSegments = new Set<number>();
  private periodStart = 0;

  constructor(deps: ActivitySamplerDeps = {}) {
    this.intervalMs = deps.intervalMs ?? DEFAULT_ACTIVITY_PERIOD_MS;
    this.sink = deps.sink ?? (() => {});
    this.now = deps.now ?? Date.now;
    this.registerInputListener =
      deps.registerInputListener ?? registerUiohookInputListener;
  }

  start(): void {
    if (this.handle) return;
    this.periodStart = this.now();
    this.activeSegments = new Set();
    this.unregisterInput = this.registerInputListener(() => this.recordInput());
    this.handle = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
    this.unregisterInput?.();
    this.unregisterInput = null;
  }

  get isRunning(): boolean {
    return this.handle !== null;
  }

  private recordInput(): void {
    if (!this.handle) return; // a queued event landing just after stop()
    this.activeSegments.add(
      segmentIndexForOffset(this.now() - this.periodStart, this.intervalMs),
    );
  }

  /** Exposed so tests can trigger one period boundary without touching timers. */
  tick(): void {
    const periodStart = this.periodStart;
    const periodEnd = this.now();

    const sample: ActivitySample = {
      activePercentage: computeActivePercentage(this.activeSegments),
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
    };
    this.sink(sample);

    this.periodStart = periodEnd;
    this.activeSegments = new Set();
  }
}
