import { InvitationStatus } from '../database/entities/invitation-status.enum';
import { computeEffectiveInvitationStatus } from './effective-invitation-status.util';

describe('computeEffectiveInvitationStatus', () => {
  const now = new Date('2026-01-15T00:00:00.000Z');

  it('returns "pending" for a pending invitation that has not expired yet', () => {
    expect(
      computeEffectiveInvitationStatus(
        {
          status: InvitationStatus.PENDING,
          expiresAt: new Date('2026-01-16T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe('pending');
  });

  it('returns "expired" for a pending invitation past its expiresAt', () => {
    expect(
      computeEffectiveInvitationStatus(
        {
          status: InvitationStatus.PENDING,
          expiresAt: new Date('2026-01-14T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe('expired');
  });

  it('treats a pending invitation with no expiresAt as never expiring', () => {
    expect(
      computeEffectiveInvitationStatus(
        { status: InvitationStatus.PENDING, expiresAt: null },
        now,
      ),
    ).toBe('pending');
  });

  it('returns "accepted" for an accepted invitation regardless of expiresAt', () => {
    expect(
      computeEffectiveInvitationStatus(
        {
          status: InvitationStatus.ACCEPTED,
          expiresAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe('accepted');
  });

  it('returns "revoked" for a revoked invitation regardless of expiresAt', () => {
    expect(
      computeEffectiveInvitationStatus(
        {
          status: InvitationStatus.REVOKED,
          expiresAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe('revoked');
  });
});
