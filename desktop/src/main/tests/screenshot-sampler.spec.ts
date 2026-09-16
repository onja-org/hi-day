import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenshotCapture } from '../screenshot-sampler';
import { ScreenshotSampler } from '../screenshot-sampler';

describe('ScreenshotSampler', () => {
  function makeSink() {
    const captures: ScreenshotCapture[] = [];
    return {
      sink: (capture: ScreenshotCapture) => {
        captures.push(capture);
      },
      captures,
    };
  }

  // isWayland: () => false makes these deterministic regardless of the
  // session actually running the test suite — see the dedicated Wayland
  // tests below for the guard itself.

  it('emits a capture with the buffer and an ISO timestamp', async () => {
    const { sink, captures } = makeSink();
    const buffer = Buffer.from('fake-jpeg-bytes');
    const sampler = new ScreenshotSampler({
      sink,
      capture: () => Promise.resolve(buffer),
      isWayland: () => false,
    });

    await sampler.tick();

    expect(captures).toHaveLength(1);
    expect(captures[0].buffer).toBe(buffer);
    expect(typeof captures[0].capturedAt).toBe('string');
  });

  it('emits nothing when capture returns null (e.g. permission not granted)', async () => {
    const { sink, captures } = makeSink();
    const sampler = new ScreenshotSampler({
      sink,
      capture: () => Promise.resolve(null),
      isWayland: () => false,
    });

    await sampler.tick();

    expect(captures).toHaveLength(0);
  });

  it('emits nothing when the underlying capture call throws', async () => {
    const { sink, captures } = makeSink();
    const sampler = new ScreenshotSampler({
      sink,
      capture: () => Promise.reject(new Error('boom')),
      isWayland: () => false,
    });

    await sampler.tick();

    expect(captures).toHaveLength(0);
  });

  it('never calls capture() (desktopCapturer) on Linux Wayland — that would otherwise prompt the OS share-screen picker every tick', async () => {
    const { sink, captures } = makeSink();
    const capture = vi.fn().mockResolvedValue(Buffer.from('fake-jpeg-bytes'));
    const capturePortal = vi.fn().mockResolvedValue(Buffer.from('fake-jpeg-bytes'));
    const sampler = new ScreenshotSampler({
      sink,
      capture,
      capturePortal,
      getPlatform: () => 'linux',
      isWayland: () => true,
      isWaylandScreenshotGranted: () => true,
    });

    await sampler.tick();

    expect(capture).not.toHaveBeenCalled();
    expect(captures).toHaveLength(1);
  });

  it('captures via the portal on Linux Wayland once the one-time grant has been given, always non-interactively', async () => {
    const { sink, captures } = makeSink();
    const buffer = Buffer.from('fake-jpeg-bytes');
    const capturePortal = vi.fn().mockResolvedValue(buffer);
    const sampler = new ScreenshotSampler({
      sink,
      capturePortal,
      getPlatform: () => 'linux',
      isWayland: () => true,
      isWaylandScreenshotGranted: () => true,
    });

    await sampler.tick();

    expect(capturePortal).toHaveBeenCalledWith(false);
    expect(captures).toHaveLength(1);
    expect(captures[0].buffer).toBe(buffer);
  });

  it('emits nothing on Linux Wayland when the one-time grant has not been given yet — never even calls the portal', async () => {
    const { sink, captures } = makeSink();
    const capturePortal = vi.fn().mockResolvedValue(Buffer.from('fake-jpeg-bytes'));
    const sampler = new ScreenshotSampler({
      sink,
      capturePortal,
      getPlatform: () => 'linux',
      isWayland: () => true,
      isWaylandScreenshotGranted: () => false,
    });

    await sampler.tick();

    expect(capturePortal).not.toHaveBeenCalled();
    expect(captures).toHaveLength(0);
  });

  it('still captures on Linux X11 (isWayland false)', async () => {
    const { sink, captures } = makeSink();
    const buffer = Buffer.from('fake-jpeg-bytes');
    const sampler = new ScreenshotSampler({
      sink,
      capture: () => Promise.resolve(buffer),
      getPlatform: () => 'linux',
      isWayland: () => false,
    });

    await sampler.tick();

    expect(captures).toHaveLength(1);
  });
});

describe('ScreenshotSampler start/stop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks immediately on start(), then on every interval, until stop()', async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const sampler = new ScreenshotSampler({ intervalMs: 5_000 });
    sampler.tick = tick;

    sampler.start();
    expect(sampler.isRunning).toBe(true);
    expect(tick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(tick).toHaveBeenCalledTimes(2);

    sampler.stop();
    expect(sampler.isRunning).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('start() is idempotent — calling it twice does not double the interval', () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const sampler = new ScreenshotSampler({ intervalMs: 5_000 });
    sampler.tick = tick;

    sampler.start();
    sampler.start();

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('setIntervalMs restarts the running timer at the new cadence, without an extra immediate tick', async () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const sampler = new ScreenshotSampler({ intervalMs: 10_000 });
    sampler.tick = tick;

    sampler.start();
    expect(tick).toHaveBeenCalledTimes(1);

    sampler.setIntervalMs(2_000);
    expect(tick).toHaveBeenCalledTimes(1); // no extra tick just from changing the interval
    expect(sampler.currentIntervalMs).toBe(2_000);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(tick).toHaveBeenCalledTimes(2);

    // The old 10s cadence no longer applies.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('setIntervalMs before start() just changes what the eventual start() uses', () => {
    const tick = vi.fn().mockResolvedValue(undefined);
    const sampler = new ScreenshotSampler({ intervalMs: 10_000 });
    sampler.tick = tick;

    sampler.setIntervalMs(3_000);
    expect(sampler.isRunning).toBe(false);
    expect(sampler.currentIntervalMs).toBe(3_000);
  });
});
