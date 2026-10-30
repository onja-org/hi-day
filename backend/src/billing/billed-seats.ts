import { MembershipStatus } from '../database/entities/membership-status.enum';

/** The part of a Membership that decides whether it is billed. */
export interface SeatCandidate {
  status: MembershipStatus;
}

/**
 * Whether a Membership costs a seat.
 *
 * "Anyone who tracks time", as the pricing page puts it, is every active
 * Membership: tracking needs no particular role and no project — a Time entry
 * may have no `projectId` at all — so there is no active member who is unable
 * to track. A Project membership role of `viewer` is a per-project grant that
 * only stops time being logged against that one project, not a kind of
 * person, so it cannot answer this question.
 *
 * Deactivated Memberships are not billed. Hubstaff charges for them until
 * they are fully removed; we deliberately do not, because an invoice that
 * bills for someone an admin has switched off reads as a trick.
 *
 * A free, non-tracking role — Hubstaff's "project viewer" — would be the one
 * active Membership that is not billed. It does not exist yet; adding it is
 * its own ticket, and this function is where it will be excluded.
 */
export function isBilledSeat(membership: SeatCandidate): boolean {
  return membership.status === MembershipStatus.ACTIVE;
}

export function countBilledSeats(memberships: SeatCandidate[]): number {
  return memberships.filter(isBilledSeat).length;
}
