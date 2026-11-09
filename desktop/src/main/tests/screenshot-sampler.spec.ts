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

  /**
   * "N per 10 minutes" is a promise about a clock period, not a cadence:
   * `start()` captures immediately, so without a quota every stop and
   * start adds one more than the organisation asked for.
   */
  describe('the per-10-minute quota', () => {
    function quotaSampler(intervalMs: number, nowMs: () => number) {
      const { sink, captures } = makeSink();
      const sampler = new ScreenshotSampler({
        sink,
        intervalMs,
        now: nowMs,
        capture: () => Promise.resolve(Buffer.from('jpeg')),
        isWayland: () => false,
      });
      return { sampler, captures };
    }

    it('allows exactly three at "3 per 10 minutes", however often it ticks', async () => {
      let now = 0;
      const { sampler, captures } = quotaSampler(200_000, () => now);

      // Ten ticks inside one period — what a morning of stopping and
      // starting the timer produces.
      for (let i = 0; i < 10; i += 1) {
        now = i * 30_000;
        await sampler.tick();
      }

      expect(captures).toHaveLength(3);
    });

    it('allows one at "1 per 10 minutes"', async () => {
      let now = 0;
      const { sampler, captures } = quotaSampler(600_000, () => now);

      for (let i = 0; i < 5; i += 1) {
        now = i * 60_000;
        await sampler.tick();
      }

      expect(captures).toHaveLength(1);
    });

    it('starts the allowance again in the next clock period', async () => {
      let now = 0;
      const { sampler, captures } = quotaSampler(200_000, () => now);

      for (let i = 0; i < 5; i += 1) {
        now = i * 30_000;
        await sampler.tick();
      }
      expect(captures).toHaveLength(3);

      // Over the 10-minute boundary.
      now = 600_000;
      await sampler.tick();

      expect(captures).toHaveLength(4);
    });

    // A tick that produced no image never got the person a screenshot, so
    // it must not spend one of their three.
    it('does not spend an allowance on a capture that produced nothing', async () => {
      const { sink, captures } = makeSink();
      let now = 0;
      let buffer: Buffer | null = null;
      const sampler = new ScreenshotSampler({
        sink,
        intervalMs: 600_000,
        now: () => now,
        capture: () => Promise.resolve(buffer),
        isWayland: () => false,
      });

      // Permission not granted yet.
      await sampler.tick();
      expect(captures).toHaveLength(0);

      // Granted, still the same period.
      buffer = Buffer.from('jpeg');
      now = 60_000;
      await sampler.tick();

      expect(captures).toHaveLength(1);
    });
  });

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
