import { computeDeviceStatus } from './device-status';

describe('computeDeviceStatus', () => {
  const now = new Date('2026-01-15T00:00:00.000Z');

  it('returns "signed_out" when there is no active session, regardless of lastSeenAt', () => {
    expect(computeDeviceStatus({ lastSeenAt: now }, false, 5, now)).toBe(
      'signed_out',
    );
  });

  it('returns "active" when seen within the heartbeat window', () => {
    expect(
      computeDeviceStatus(
        { lastSeenAt: new Date('2026-01-14T23:58:00.000Z') },
        true,
        5,
        now,
      ),
    ).toBe('active');
  });

  it('returns "offline" when last seen beyond the heartbeat window', () => {
    expect(
      computeDeviceStatus(
        { lastSeenAt: new Date('2026-01-14T23:00:00.000Z') },
        true,
        5,
        now,
      ),
    ).toBe('offline');
  });

  it('treats a device with an active session but no lastSeenAt as offline', () => {
    expect(computeDeviceStatus({ lastSeenAt: null }, true, 5, now)).toBe(
      'offline',
    );
  });
});
