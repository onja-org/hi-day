/**
 * Mirrors the subset of backend's DevicePlatform enum
 * (backend/src/database/entities/device-platform.enum.ts) that a desktop
 * agent can actually run on.
 */
export type DesktopDevicePlatform = 'windows' | 'macos' | 'linux';

export function toDevicePlatform(nodePlatform: NodeJS.Platform): DesktopDevicePlatform {
  switch (nodePlatform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      throw new Error(`Unsupported desktop platform: ${nodePlatform}`);
  }
}

/**
 * Wayland gives no protocol for reading another application's window, so a
 * Wayland-native window is only visible through AT-SPI; XWayland clients are
 * still read from X11. Decides whether WindowSampler falls back to AT-SPI
 * when X11 reports no focused window (see docs/adr/0026-...).
 */
export function isWaylandSession(): boolean {
  return process.platform === 'linux' && !!process.env.WAYLAND_DISPLAY;
}
