import { describe, expect, it, vi } from 'vitest';
import { GnomeWindowFocusTracker } from '../gnome-window-focus-tracker';

describe('GnomeWindowFocusTracker', () => {
  it('getLastFocus is null before start() and before any activation', () => {
    const tracker = new GnomeWindowFocusTracker({
      enableAccessibilityBridge: vi.fn().mockResolvedValue(undefined),
      createAtspiClient: () => ({
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(),
      }),
    });

    expect(tracker.getLastFocus()).toBeNull();
  });

  it('records the last window:activate callback as getLastFocus', async () => {
    let capturedCallback: ((window: { bus: string; path: string; appName: string; title: string }) => void) | null =
      null;
    const tracker = new GnomeWindowFocusTracker({
      enableAccessibilityBridge: vi.fn().mockResolvedValue(undefined),
      createAtspiClient: (options) => {
        capturedCallback = options.onWindowActivated;
        return { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() };
      },
    });

    await tracker.start();
    expect(capturedCallback).not.toBeNull();

    capturedCallback!({ bus: ':1.10', path: '/x', appName: 'Slack', title: 'general - Slack' });

    expect(tracker.getLastFocus()).toEqual({ appName: 'Slack', title: 'general - Slack' });

    capturedCallback!({ bus: ':1.21', path: '/y', appName: 'Google Chrome', title: 'Example' });
    expect(tracker.getLastFocus()).toEqual({ appName: 'Google Chrome', title: 'Example' });
  });

  it('calls enableAccessibilityBridge before subscribing, but still subscribes if it throws', async () => {
    const enableAccessibilityBridge = vi
      .fn()
      .mockRejectedValue(new Error('IsEnabled not settable in this test session'));
    const clientStart = vi.fn().mockResolvedValue(undefined);
    const tracker = new GnomeWindowFocusTracker({
      enableAccessibilityBridge,
      createAtspiClient: () => ({ start: clientStart, stop: vi.fn() }),
    });

    await tracker.start();

    expect(enableAccessibilityBridge).toHaveBeenCalledTimes(1);
    expect(clientStart).toHaveBeenCalledTimes(1);
  });

  it('start() never throws even when the accessibility bus itself is unreachable', async () => {
    const tracker = new GnomeWindowFocusTracker({
      enableAccessibilityBridge: vi.fn().mockResolvedValue(undefined),
      createAtspiClient: () => ({
        start: vi.fn().mockRejectedValue(new Error('accessibility bus unavailable')),
        stop: vi.fn(),
      }),
    });

    await expect(tracker.start()).resolves.toBeUndefined();
    expect(tracker.getLastFocus()).toBeNull();
  });

  it('stop() clears the client and the last-known focus', async () => {
    let capturedCallback: ((window: { bus: string; path: string; appName: string; title: string }) => void) | null =
      null;
    const clientStop = vi.fn();
    const tracker = new GnomeWindowFocusTracker({
      enableAccessibilityBridge: vi.fn().mockResolvedValue(undefined),
      createAtspiClient: (options) => {
        capturedCallback = options.onWindowActivated;
        return { start: vi.fn().mockResolvedValue(undefined), stop: clientStop };
      },
    });

    await tracker.start();
    capturedCallback!({ bus: ':1.10', path: '/x', appName: 'Slack', title: 'general - Slack' });
    expect(tracker.getLastFocus()).not.toBeNull();

    tracker.stop();

    expect(clientStop).toHaveBeenCalledTimes(1);
    expect(tracker.getLastFocus()).toBeNull();
  });
});
