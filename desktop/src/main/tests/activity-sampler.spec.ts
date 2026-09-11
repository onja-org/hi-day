import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivitySample } from '../activity-sample';
import { SEGMENT_DURATION_MS } from '../activity-sample';
import { ActivitySampler } from '../activity-sampler';

describe('ActivitySampler', () => {
  function makeSink() {
    const samples: ActivitySample[] = [];
    return { sink: (sample: ActivitySample) => samples.push(sample), samples };
  }

  /** A fake clock plus a fake input listener that a test can fire directly, standing in for uiohook-napi. */
  function makeHarness(startMs = 0) {
    let now = startMs;
    let onInput: (() => void) | null = null;
    const unregister = vi.fn(() => {
      onInput = null;
    });
    const registerInputListener = vi.fn((handler: () => void) => {
      onInput = handler;
      return unregister;
    });
    return {
      now: () => now,
      advance: (ms: number) => {
        now += ms;
      },
      fireInput: () => onInput?.(),
      registerInputListener,
      unregister,
    };
  }

  it('emits 0% when the period elapses with no input at all', () => {
    const { sink, samples } = makeSink();
    const harness = makeHarness();
    const sampler = new ActivitySampler({
      sink,
      now: harness.now,
      registerInputListener: harness.registerInputListener,
    });

    sampler.start();
    sampler.tick();

    expect(samples).toHaveLength(1);
    expect(samples[0].activePercentage).toBe(0);
  });

  it('emits 100% when input lands in every one of the 60 segments', () => {
    const { sink, samples } = makeSink();
    const harness = makeHarness();
    const sampler = new ActivitySampler({
      sink,
      now: harness.now,
      registerInputListener: harness.registerInputListener,
    });

    sampler.start();
    for (let i = 0; i < 60; i++) {
      harness.fireInput();
      harness.advance(SEGMENT_DURATION_MS);
    }
    sampler.tick();

    expect(samples[0].activePercentage).toBe(100);
  });

  it('counts repeated input within the same 10s segment only once', () => {
    const { sink, samples } = makeSink();
    const harness = makeHarness();
    const sampler = new ActivitySampler({
      sink,
      now: harness.now,
      registerInputListener: harness.registerInputListener,
    });

    sampler.start();
    harness.fireInput();
    harness.fireInput();
    harness.fireInput();
    sampler.tick();

    expect(samples[0].activePercentage).toBe(2); // 1 of 60 segments, rounded
  });

  it('scales segment duration to a custom intervalMs (e.g. DESKTOP_ACTIVITY_PERIOD_MS for testing)', () => {
    const { sink, samples } = makeSink();
    const harness = makeHarness();
    const oneMinute = 60_000;
    const sampler = new ActivitySampler({
      sink,
      intervalMs: oneMinute,
      now: harness.now,
      registerInputListener: harness.registerInputListener,
    });

    sampler.start();
    harness.fireInput(); // lands in segment 0 of a 60-segment, 1-minute period
    sampler.tick();

    expect(samples[0].activePercentage).toBe(2); // 1 of 60 segments, same as the default 10-minute period
  });

  it('reports periodStart/periodEnd as the actual period boundaries, and starts the next period fresh', () => {
    const { sink, samples } = makeSink();
    const harness = makeHarness(1_000);
    const sampler = new ActivitySampler({
      sink,
      now: harness.now,
      registerInputListener: harness.registerInputListener,
    });

    sampler.start();
    harness.fireInput();
    harness.advance(600_000);
    sampler.tick();

    expect(samples[0]).toEqual({
      activePercentage: 2,
      periodStart: new Date(1_000).toISOString(),
      periodEnd: new Date(601_000).toISOString(),
    });

    // Second period: no input at all this time.
    harness.advance(600_000);
    sampler.tick();

    expect(samples[1]).toEqual({
      activePercentage: 0,
      periodStart: new Date(601_000).toISOString(),
      periodEnd: new Date(1_201_000).toISOString(),
    });
  });

  it('ignores input that arrives after stop() unregistered the listener', () => {
    const { sink } = makeSink();
    const harness = makeHarness();
    const sampler = new ActivitySampler({
      sink,
      now: harness.now,
      registerInputListener: harness.registerInputListener,
    });

    sampler.start();
    sampler.stop();
    harness.fireInput(); // no-op: registerInputListener's own unregister already nulled the handler
    expect(harness.unregister).toHaveBeenCalledTimes(1);
  });

  it('does not register a second input listener on a repeated start()', () => {
    const { sink } = makeSink();
    const harness = makeHarness();
    const sampler = new ActivitySampler({
      sink,
      now: harness.now,
      registerInputListener: harness.registerInputListener,
    });

    sampler.start();
    sampler.start();

    expect(harness.registerInputListener).toHaveBeenCalledTimes(1);
  });
});

describe('ActivitySampler start/stop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks on every interval until stop(), but never immediately on start()', () => {
    const tick = vi.fn();
    const sampler = new ActivitySampler({
      intervalMs: 600_000,
      registerInputListener: () => () => {},
    });
    sampler.tick = tick;

    sampler.start();
    expect(sampler.isRunning).toBe(true);
    expect(tick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(600_000);
    expect(tick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600_000);
    expect(tick).toHaveBeenCalledTimes(2);

    sampler.stop();
    expect(sampler.isRunning).toBe(false);

    vi.advanceTimersByTime(1_200_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('start() is idempotent — calling it twice does not double the interval', () => {
    const tick = vi.fn();
    const sampler = new ActivitySampler({
      intervalMs: 600_000,
      registerInputListener: () => () => {},
    });
    sampler.tick = tick;

    sampler.start();
    sampler.start();

    vi.advanceTimersByTime(600_000);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});
