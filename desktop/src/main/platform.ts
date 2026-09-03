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
