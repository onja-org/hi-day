import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WindowSample } from '../window-sample';
import { WindowSampler } from '../window-sampler';

describe('WindowSampler', () => {
  function makeSink() {
    const samples: WindowSample[] = [];
    return { sink: (sample: WindowSample) => samples.push(sample), samples };
  }

  it('emits app name and title when everything is available', async () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'windows',
      isWayland: () => false,
      isMacAccessibilityGranted: () => true,
      loadActiveWindow: () =>
        Promise.resolve(() =>
          Promise.resolve({
            title: 'Budget.xlsx - Excel',
            owner: { name: 'Excel', processId: 1, path: '/x' },
            platform: 'windows',
          }),
        ),
    });

    await sampler.tick();

    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      appName: 'Excel',
      title: 'Budget.xlsx - Excel',
      titleUnavailableReason: null,
    });
    expect(typeof samples[0].sampledAt).toBe('string');
  });

  it("emits app name only, tagged 'permission-denied', on macOS without Accessibility", async () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'macos',
      isWayland: () => false,
      isMacAccessibilityGranted: () => false,
      loadActiveWindow: () =>
        Promise.resolve(() =>
          Promise.resolve({
            title: 'Some Title',
            owner: { name: 'Mail', processId: 1, path: '/m' },
            platform: 'macos',
          }),
        ),
    });

    await sampler.tick();

    expect(samples[0]).toEqual({
      appName: 'Mail',
      title: null,
      titleUnavailableReason: 'permission-denied',
      sampledAt: samples[0].sampledAt,
    });
  });

  it("short-circuits on Wayland, never calling get-windows, tagged 'not-exposed'", async () => {
    const { sink, samples } = makeSink();
    const loadActiveWindow = vi.fn();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => true,
      isMacAccessibilityGranted: () => true,
      loadActiveWindow,
    });

    await sampler.tick();

    expect(loadActiveWindow).not.toHaveBeenCalled();
    expect(samples[0]).toEqual({
      appName: null,
      title: null,
      titleUnavailableReason: 'not-exposed',
      sampledAt: samples[0].sampledAt,
    });
  });

  it("tags 'hidden-by-app' when the app returns no title despite permission being fine", async () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => false,
      isMacAccessibilityGranted: () => true,
      loadActiveWindow: () =>
        Promise.resolve(() =>
          Promise.resolve({
            title: '',
            owner: { name: 'Signal', processId: 1, path: '/s' },
            platform: 'linux',
          }),
        ),
    });

    await sampler.tick();

    expect(samples[0]).toMatchObject({
      appName: 'Signal',
      title: null,
      titleUnavailableReason: 'hidden-by-app',
    });
  });

  it('still emits a sample when the underlying call throws, never skipping a tick', async () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => false,
      isMacAccessibilityGranted: () => true,
      loadActiveWindow: () => Promise.reject(new Error('boom')),
    });

    await sampler.tick();

    expect(samples).toHaveLength(1);
    expect(samples[0].appName).toBeNull();
  });

  it('never calls loadActiveWindow more than once — the module load is cached', async () => {
    const { sink } = makeSink();
    const loadActiveWindow = vi.fn().mockResolvedValue(() =>
      Promise.resolve(undefined),
    );
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => false,
      isMacAccessibilityGranted: () => true,
      loadActiveWindow,
    });

    await sampler.tick();
    await sampler.tick();

    expect(loadActiveWindow).toHaveBeenCalledTimes(2);
  });
});

describe('WindowSampler start/stop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks immediately on start(), then on every interval, until stop()', async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const sampler = new WindowSampler({ intervalMs: 5_000 });
    sampler.tick = tick;

    sampler.start();
    expect(sampler.isRunning).toBe(true);
    expect(tick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(tick).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(tick).toHaveBeenCalledTimes(3);

    sampler.stop();
    expect(sampler.isRunning).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('start() is idempotent — calling it twice does not double the interval', () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const sampler = new WindowSampler({ intervalMs: 5_000 });
    sampler.tick = tick;

    sampler.start();
    sampler.start();

    expect(tick).toHaveBeenCalledTimes(1);
  });
});
