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

  it("with no usable X11, never calls @paymoapp/active-window and tags 'not-exposed' until a GNOME focus is seen", () => {
    const { sink, samples } = makeSink();
    const getActiveWindow = vi.fn();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => true,
      getX11Focus: () => null,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow,
      getGnomeFocus: () => null,
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

  it("short-circuits on Wayland the same way when getGnomeFocus is never wired up at all (default)", () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => true,
      getX11Focus: () => null,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow: vi.fn(),
    });

    sampler.tick();

    expect(samples[0]).toMatchObject({
      appName: null,
      title: null,
      titleUnavailableReason: 'not-exposed',
    });
  });

  it('on Wayland, reports the GNOME (AT-SPI) focus instead of not-exposed once one has been seen', () => {
    const { sink, samples } = makeSink();
    const getActiveWindow = vi.fn();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => true,
      getX11Focus: () => null,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow,
      getGnomeFocus: () => ({ appName: 'Google Chrome', title: 'Example Domain' }),
    });

    sampler.tick();

    expect(getActiveWindow).not.toHaveBeenCalled();
    expect(samples[0]).toEqual({
      appName: 'Google Chrome',
      title: 'Example Domain',
      titleUnavailableReason: null,
      sampledAt: samples[0].sampledAt,
    });
  });

  it("on Wayland, tags 'hidden-by-app' when GNOME focus has an app name but an empty title", () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => true,
      getX11Focus: () => null,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow: vi.fn(),
      getGnomeFocus: () => ({ appName: 'gnome-shell', title: '' }),
    });

    sampler.tick();

    expect(samples[0]).toMatchObject({
      appName: 'gnome-shell',
      title: null,
      titleUnavailableReason: 'hidden-by-app',
    });
  });

  it("tags 'hidden-by-app' when the app returns no title despite permission being fine", () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'windows',
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
      getPlatform: () => 'windows',
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
      getPlatform: () => 'windows',
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

/**
 * The gap this ordering exists to close. A Wayland session still runs most
 * applications under XWayland, where X11 sees them — measured on GNOME 46:
 * jetbrains-pycharm, vlc and teams-for-linux all reported by name and title,
 * none of which publish an accessibility tree at all.
 */
describe('WindowSampler — Wayland with XWayland available', () => {
  function makeSink() {
    const samples: WindowSample[] = [];
    return { sink: (sample: WindowSample) => samples.push(sample), samples };
  }

  it('prefers X11, which sees applications AT-SPI cannot', () => {
    const { sink, samples } = makeSink();
    const getGnomeFocus = vi.fn(() => ({ appName: 'gnome-shell', title: 'Overview' }));
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => true,
      isMacScreenRecordingGranted: () => true,
      getX11Focus: () => ({
        appName: 'jetbrains-pycharm',
        title: 'workforce-monitoring-app',
      }),
      getGnomeFocus,
    });

    sampler.tick();

    expect(samples[0].appName).toBe('jetbrains-pycharm');
    expect(samples[0].title).toBe('workforce-monitoring-app');
    expect(getGnomeFocus).not.toHaveBeenCalled();
  });

  /** X11 reports nothing exactly when a Wayland-native window has focus. */
  it('falls back to AT-SPI when X11 reports no active window', () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => true,
      isMacScreenRecordingGranted: () => true,
      getX11Focus: () => null,
      getGnomeFocus: () => ({ appName: 'gnome-terminal-server', title: 'bash' }),
    });

    sampler.tick();

    expect(samples[0].appName).toBe('gnome-terminal-server');
    expect(samples[0].title).toBe('bash');
  });

  it('never touches the native addon when X11 is unusable', () => {
    const { sink } = makeSink();
    const getActiveWindow = vi.fn();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => true,
      getX11Focus: () => null,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow,
      getGnomeFocus: () => ({ appName: 'nautilus', title: 'Home' }),
    });

    sampler.tick();

    expect(getActiveWindow).not.toHaveBeenCalled();
  });
});

/**
 * The bug this ordering fixed: on Xorg the sampler used to call the native
 * addon, whose Linux binary needs glibc 2.38 — on Ubuntu 22.04 it never
 * loaded, and every sample came back empty.
 */
describe('WindowSampler — Xorg', () => {
  function makeSink() {
    const samples: WindowSample[] = [];
    return { sink: (sample: WindowSample) => samples.push(sample), samples };
  }

  it('reads the focused window from X11 and never touches the native addon', () => {
    const { sink, samples } = makeSink();
    const getActiveWindow = vi.fn(() => {
      throw new Error("version `GLIBC_2.38' not found");
    });
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => false,
      isMacScreenRecordingGranted: () => true,
      getActiveWindow,
      getX11Focus: () => ({ appName: 'Google-chrome', title: 'Inbox - Google Chrome' }),
    });

    sampler.tick();

    expect(getActiveWindow).not.toHaveBeenCalled();
    expect(samples[0]).toEqual({
      appName: 'Google-chrome',
      title: 'Inbox - Google Chrome',
      titleUnavailableReason: null,
      sampledAt: samples[0].sampledAt,
    });
  });

  it("tags 'hidden-by-app' when the X11 window has a class but no title", () => {
    const { sink, samples } = makeSink();
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => false,
      isMacScreenRecordingGranted: () => true,
      getX11Focus: () => ({ appName: 'Signal', title: '' }),
    });

    sampler.tick();

    expect(samples[0]).toMatchObject({
      appName: 'Signal',
      title: null,
      titleUnavailableReason: 'hidden-by-app',
    });
  });

  it('reports nothing focused, without falling back to AT-SPI, when X11 has no active window', () => {
    const { sink, samples } = makeSink();
    const getGnomeFocus = vi.fn(() => ({ appName: 'stale', title: 'stale' }));
    const sampler = new WindowSampler({
      sink,
      getPlatform: () => 'linux',
      isWayland: () => false,
      isMacScreenRecordingGranted: () => true,
      getX11Focus: () => null,
      getGnomeFocus,
    });

    sampler.tick();

    expect(getGnomeFocus).not.toHaveBeenCalled();
    expect(samples[0]).toEqual({
      appName: null,
      title: null,
      titleUnavailableReason: null,
      sampledAt: samples[0].sampledAt,
    });
  });
});
