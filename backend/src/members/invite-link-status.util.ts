export type InviteLinkStatus = 'active' | 'disabled' | 'expired' | 'full';

/** Whether a link can still bring people in, and if not, why. Disabled
 * wins over expired, which wins over full. */
export function computeInviteLinkStatus(
  link: {
    enabled: boolean;
    expiresAt: Date | null;
    usageCap: number | null;
    usageCount: number;
  },
  now: Date,
): InviteLinkStatus {
  if (!link.enabled) return 'disabled';
  if (link.expiresAt && link.expiresAt.getTime() < now.getTime()) {
    return 'expired';
  }
  if (link.usageCap !== null && link.usageCount >= link.usageCap) return 'full';
  return 'active';
}
