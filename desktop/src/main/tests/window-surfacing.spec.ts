import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ScreenshotEnabledWatcher,
  SurfacedOnce,
  decideSurface,
  installSurfaceHandler,
  resetSurfacing,
  surfaceCopy,
  surfaceWindow,
} from '../window-surfacing';

afterEach(() => resetSurfacing());

const away = 600;
const atKeyboard = 2;
const hidden = { exists: true, visible: false, focused: false, minimized: false };

describe('ScreenshotEnabledWatcher', () => {
  it('fires on off-to-on', () => {
    const watcher = new ScreenshotEnabledWatcher();

    expect(watcher.observe(false)).toBe(false);
    expect(watcher.observe(true)).toBe(true);
  });

  it('stays quiet when the agent starts up with capture already on', () => {
    // The settings gate replays cached settings through prime() on launch —
    // that is a baseline, not somebody switching it on.
    const watcher = new ScreenshotEnabledWatcher();

    expect(watcher.observe(true)).toBe(false);
  });

  it('stays quiet while it keeps being reported on, poll after poll', () => {
    const watcher = new ScreenshotEnabledWatcher();
    watcher.observe(false);
    watcher.observe(true);

    expect(watcher.observe(true)).toBe(false);
    expect(watcher.observe(true)).toBe(false);
  });

  it('fires again only after it was really switched back off', () => {
    const watcher = new ScreenshotEnabledWatcher();
    watcher.observe(false);
    watcher.observe(true);

    expect(watcher.observe(false)).toBe(false);
    expect(watcher.observe(true)).toBe(true);
  });

  it('does not fire on on-to-off', () => {
    const watcher = new ScreenshotEnabledWatcher();
    watcher.observe(true);

    expect(watcher.observe(false)).toBe(false);
  });
});

describe('SurfacedOnce', () => {
  it('lets each event through exactly once', () => {
    const once = new SurfacedOnce();
    const request = { reason: 'screenshots-enabled' } as const;

    expect(once.shouldSurface(request)).toBe(true);
    expect(once.shouldSurface(request)).toBe(false);
  });

  it('announces a version once, not once per update phase', () => {
    const once = new SurfacedOnce();

    expect(
      once.shouldSurface({ reason: 'update-available', occurrence: '1.4.0' }),
    ).toBe(true);
    expect(
      once.shouldSurface({ reason: 'update-downloaded', occurrence: '1.4.0' }),
    ).toBe(false);
  });

  it('announces the next version again', () => {
    const once = new SurfacedOnce();
    once.shouldSurface({ reason: 'update-available', occurrence: '1.4.0' });

    expect(
      once.shouldSurface({ reason: 'update-available', occurrence: '1.5.0' }),
    ).toBe(true);
  });
});

describe('decideSurface', () => {
  it('does nothing when the window is already being looked at', () => {
    expect(
      decideSurface(
        { exists: true, visible: true, focused: true, minimized: false },
        away,
      ),
    ).toBe('nothing');
  });

  it('notifies rather than stealing focus from someone mid-keystroke', () => {
    expect(decideSurface(hidden, atKeyboard)).toBe('notify');
  });

  it('raises when they have stepped away, so it is waiting on their return', () => {
    expect(decideSurface(hidden, away)).toBe('raise');
  });

  it('raises a minimised window — visible is not the same as looked at', () => {
    expect(
      decideSurface(
        { exists: true, visible: true, focused: false, minimized: true },
        away,
      ),
    ).toBe('raise');
  });

  it('still surfaces when the window was closed to the tray entirely', () => {
    expect(
      decideSurface(
        { exists: false, visible: false, focused: false, minimized: false },
        away,
      ),
    ).toBe('raise');
  });

  it('a visible but unfocused window is behind something — notify', () => {
    expect(
      decideSurface(
        { exists: true, visible: true, focused: false, minimized: false },
        atKeyboard,
      ),
    ).toBe('notify');
  });
});

describe('surfaceWindow', () => {
  it('does nothing before a handler is installed', () => {
    expect(() => surfaceWindow({ reason: 'screenshots-enabled' })).not.toThrow();
  });

  it('calls the handler once however often the event is reported', () => {
    const handler = vi.fn();
    installSurfaceHandler(handler);

    surfaceWindow({ reason: 'screenshots-enabled' });
    surfaceWindow({ reason: 'screenshots-enabled' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('swallows a throwing handler, so the caller carries on', () => {
    const log = vi.fn();
    installSurfaceHandler(() => {
      throw new Error('no window');
    }, log);

    expect(() => surfaceWindow({ reason: 'screenshots-enabled' })).not.toThrow();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('screenshots-enabled'));
  });

  it('swallows a rejecting handler too', async () => {
    const log = vi.fn();
    installSurfaceHandler(() => Promise.reject(new Error('no window')), log);

    surfaceWindow({ reason: 'screenshots-enabled' });
    await Promise.resolve();
    await Promise.resolve();

    expect(log).toHaveBeenCalledWith(expect.stringContaining('screenshots-enabled'));
  });
});

describe('surfaceCopy', () => {
  it('names the version it is talking about', () => {
    expect(surfaceCopy({ reason: 'update-downloaded', occurrence: '1.4.0' }).body).toContain(
      '1.4.0',
    );
  });

  it('says who turned screenshots on, since nothing else will', () => {
    const copy = surfaceCopy({ reason: 'screenshots-enabled' });

    expect(copy.title).toBe('Screenshot capture enabled');
    expect(copy.body).toContain('admin');
  });

  it('still reads properly when the updater reports no version', () => {
    expect(surfaceCopy({ reason: 'update-available' }).body).not.toContain('undefined');
  });
});
