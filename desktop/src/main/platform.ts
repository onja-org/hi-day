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
 * Wayland gives no way to identify the active window at all — both
 * get-windows and @paymoapp/active-window only support X11 on Linux, "for
 * security reasons" per their docs — checked before ever calling into the
 * window-capture library on Linux, not treated as a call that might fail.
 * Matches the desktop app's existing "Linux best-effort" support level
 * (see docs/adr/0007-... for the same caveat on idle detection).
 */
export function isWaylandSession(): boolean {
  return process.platform === 'linux' && !!process.env.WAYLAND_DISPLAY;
}
