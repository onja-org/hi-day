import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWaylandSession, toDevicePlatform } from '../platform';

describe('toDevicePlatform', () => {
  it('maps win32 to windows', () => {
    expect(toDevicePlatform('win32')).toBe('windows');
  });

  it('maps darwin to macos', () => {
    expect(toDevicePlatform('darwin')).toBe('macos');
  });

  it('maps linux to linux', () => {
    expect(toDevicePlatform('linux')).toBe('linux');
  });

  it('throws for an unsupported platform', () => {
    expect(() => toDevicePlatform('aix')).toThrow('Unsupported desktop platform: aix');
  });
});

describe('isWaylandSession', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    vi.unstubAllEnvs();
  });

  it('is true on Linux when WAYLAND_DISPLAY is set', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    vi.stubEnv('WAYLAND_DISPLAY', 'wayland-0');

    expect(isWaylandSession()).toBe(true);
  });

  it('is false on Linux when WAYLAND_DISPLAY is unset', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    vi.stubEnv('WAYLAND_DISPLAY', undefined);

    expect(isWaylandSession()).toBe(false);
  });

  it('is false on non-Linux platforms even if WAYLAND_DISPLAY happens to be set', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    vi.stubEnv('WAYLAND_DISPLAY', 'wayland-0');

    expect(isWaylandSession()).toBe(false);
  });
});
