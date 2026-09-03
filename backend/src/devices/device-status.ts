import { Device } from '../database/entities/device.entity';

export type DeviceStatus = 'active' | 'offline' | 'signed_out';

export const DEFAULT_DEVICE_HEARTBEAT_WINDOW_MINUTES = 5;
const MS_PER_MINUTE = 60 * 1000;

/**
 * Active/Offline is never stored — it's derived from `lastSeenAt` against
 * the heartbeat window every time a Device is read, so there's no separate
 * status column that could drift from what the timestamps actually say.
 * Signed-out is the one state that *is* backed by stored fact: whether the
 * device currently has any non-revoked DeviceSession.
 */
export function computeDeviceStatus(
  device: Pick<Device, 'lastSeenAt'>,
  hasActiveSession: boolean,
  heartbeatWindowMinutes: number,
  now: Date = new Date(),
): DeviceStatus {
  if (!hasActiveSession) {
    return 'signed_out';
  }

  const windowMs = heartbeatWindowMinutes * MS_PER_MINUTE;
  const lastSeenMs = device.lastSeenAt?.getTime() ?? 0;

  return now.getTime() - lastSeenMs <= windowMs ? 'active' : 'offline';
}
