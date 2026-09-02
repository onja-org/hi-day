import { InvitationStatus } from '../database/entities/invitation-status.enum';

export type EffectiveInvitationStatus =
  'pending' | 'accepted' | 'revoked' | 'expired';

/**
 * `InvitationStatus` only tracks pending/accepted/revoked in the database
 */
export function computeEffectiveInvitationStatus(
  invitation: { status: InvitationStatus; expiresAt: Date | null },
  now: Date,
): EffectiveInvitationStatus {
  const isExpired =
    invitation.status === InvitationStatus.PENDING &&
    invitation.expiresAt !== null &&
    invitation.expiresAt.getTime() < now.getTime();

  return isExpired ? 'expired' : invitation.status;
}
