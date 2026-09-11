import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WindowSample } from '../window-sample';
import { WindowSampler } from '../window-sampler';

describe('WindowSampler', () => {
  function makeSink() {
    const samples: WindowSample[] = [];
    return { sink: (sample: WindowSample) => samples.push(sample), samples };
  }

  it('emits app name and title when everything is available', () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'windows',
      isWayland: () => false,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow: () => ({
        title: 'Budget.xlsx - Excel',
        application: 'Excel',
        pid: 1,
        path: '/x',
        icon: '',
      }),
    });

    sampler.tick();

    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      appName: 'Excel',
      title: 'Budget.xlsx - Excel',
      titleUnavailableReason: null,
    });
    expect(typeof samples[0].sampledAt).toBe('string');
  });

  it("emits app name only, tagged 'permission-denied', on macOS without Screen Recording", () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'macos',
      isWayland: () => false,
      isMacScreenRecordingGranted: () => false,
      getActiveWindow: () => ({
        title: 'Some Title',
        application: 'Mail',
        pid: 1,
        path: '/m',
        icon: '',
      }),
    });

    sampler.tick();

    expect(samples[0]).toEqual({
      appName: 'Mail',
      title: null,
      titleUnavailableReason: 'permission-denied',
      sampledAt: samples[0].sampledAt,
    });
  });

  it("short-circuits on Wayland, never calling @paymoapp/active-window, tagged 'not-exposed'", () => {
    const { sink, samples } = makeSink();
    const getActiveWindow = vi.fn();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => true,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow,
    });

    sampler.tick();

    expect(getActiveWindow).not.toHaveBeenCalled();
    expect(samples[0]).toEqual({
      appName: null,
      title: null,
      titleUnavailableReason: 'not-exposed',
      sampledAt: samples[0].sampledAt,
    });
  });

  it("tags 'hidden-by-app' when the app returns no title despite permission being fine", () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => false,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow: () => ({
        title: '',
        application: 'Signal',
        pid: 1,
        path: '/s',
        icon: '',
      }),
    });

    sampler.tick();

    expect(samples[0]).toMatchObject({
      appName: 'Signal',
      title: null,
      titleUnavailableReason: 'hidden-by-app',
    });
  });

  it('still emits a sample when the underlying call throws, never skipping a tick', () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => false,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow: () => {
        throw new Error('boom');
      },
    });

    sampler.tick();

    expect(samples).toHaveLength(1);
    expect(samples[0].appName).toBeNull();
  });

  it('still emits a sample when there is no focused window at all (getActiveWindow throws)', () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => false,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow: () => {
        // @paymoapp/active-window's own contract: throws rather than
        // returning undefined when nothing is focused (e.g. everything
        // minimized).
        throw new Error('no focused window');
      },
    });

    sampler.tick();

    expect(samples).toHaveLength(1);
    expect(samples[0].appName).toBeNull();
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
