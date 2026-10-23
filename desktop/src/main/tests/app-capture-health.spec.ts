import { describe, expect, it } from 'vitest';
import {
  assessAppCapture,
  describeDisplaySession,
  type AppCaptureSources,
} from '../app-capture-health';

function linux(overrides: Partial<AppCaptureSources>): AppCaptureSources {
  return {
    platform: 'linux',
    isWayland: false,
    x11: 'up',
    atspi: 'up',
    atspiFailure: null,
    nativeAddonLoaded: false,
    ...overrides,
  };
}

describe('assessAppCapture', () => {
  it('is ok on Xorg once X11 answers, whatever AT-SPI did', () => {
    expect(assessAppCapture(linux({ atspi: 'down' }))).toEqual({
      status: 'ok',
      detail: null,
    });
  });

  it('ignores the native addon on Linux — it is never loaded there', () => {
    expect(assessAppCapture(linux({ nativeAddonLoaded: false }))?.status).toBe('ok');
  });

  it('is unavailable on Xorg when no X display answers', () => {
    const health = assessAppCapture(linux({ x11: 'down' }));
    expect(health?.status).toBe('unavailable');
    expect(health?.detail).toContain('X display');
  });

  it('says nothing until the sources have started', () => {
    expect(assessAppCapture(linux({ x11: 'starting' }))).toBeNull();
    expect(
      assessAppCapture(linux({ isWayland: true, atspi: 'starting' })),
    ).toBeNull();
  });

  it('is ok on Wayland when both X11 and AT-SPI are up', () => {
    expect(assessAppCapture(linux({ isWayland: true }))?.status).toBe('ok');
  });

  it('is degraded on Wayland without AT-SPI, naming the cause', () => {
    const health = assessAppCapture(
      linux({
        isWayland: true,
        atspi: 'down',
        atspiFailure: 'event-registration-failed',
      }),
    );
    expect(health?.status).toBe('degraded');
    expect(health?.detail).toContain('natively on Wayland');
    expect(health?.detail).toContain('did not accept the listener');
  });

  it('is degraded on Wayland without XWayland', () => {
    const health = assessAppCapture(linux({ isWayland: true, x11: 'down' }));
    expect(health?.status).toBe('degraded');
    expect(health?.detail).toContain('XWayland');
  });

  it('is unavailable on Wayland when neither source answers', () => {
    const health = assessAppCapture(
      linux({
        isWayland: true,
        x11: 'down',
        atspi: 'down',
        atspiFailure: 'bus-unavailable',
      }),
    );
    expect(health?.status).toBe('unavailable');
    expect(health?.detail).toContain('is not running');
  });

  it('judges Windows and macOS on the native addon alone', () => {
    const base = linux({ x11: 'down', atspi: 'down' });
    expect(
      assessAppCapture({ ...base, platform: 'windows', nativeAddonLoaded: true })?.status,
    ).toBe('ok');
    expect(
      assessAppCapture({ ...base, platform: 'macos', nativeAddonLoaded: false })?.status,
    ).toBe('unavailable');
  });
});

describe('describeDisplaySession', () => {
  it('pairs the session type with the desktop on Linux', () => {
    expect(
      describeDisplaySession('linux', {
        sessionType: 'x11',
        currentDesktop: 'ubuntu:GNOME',
      }),
    ).toBe('x11 · ubuntu:GNOME');
  });

  it('falls back to unknown when the session type is missing', () => {
    expect(
      describeDisplaySession('linux', { sessionType: undefined, currentDesktop: undefined }),
    ).toBe('unknown');
  });

  it('is null off Linux', () => {
    expect(
      describeDisplaySession('windows', { sessionType: 'x11', currentDesktop: 'x' }),
    ).toBeNull();
  });
});
