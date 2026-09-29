import { computeInviteLinkStatus } from './invite-link-status.util';

describe('computeInviteLinkStatus', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  const base = {
    enabled: true,
    expiresAt: null,
    usageCap: null,
    usageCount: 0,
  };

  it('is active when enabled, unexpired and under its cap', () => {
    expect(computeInviteLinkStatus(base, now)).toBe('active');
    expect(
      computeInviteLinkStatus({ ...base, usageCap: 3, usageCount: 2 }, now),
    ).toBe('active');
  });

  it('is disabled when switched off, whatever else is true', () => {
    expect(
      computeInviteLinkStatus(
        { ...base, enabled: false, expiresAt: new Date('2020-01-01') },
        now,
      ),
    ).toBe('disabled');
  });

  it('is expired once past its expiry date', () => {
    expect(
      computeInviteLinkStatus(
        { ...base, expiresAt: new Date('2026-09-28') },
        now,
      ),
    ).toBe('expired');
  });

  it('is full once accepted joins reach the cap', () => {
    expect(
      computeInviteLinkStatus({ ...base, usageCap: 2, usageCount: 2 }, now),
    ).toBe('full');
  });
});
