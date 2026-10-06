import type {
  OrganisationDeletionState,
  OrganisationProfile,
} from "@/types/organisation";

/**
 * Suspension wins over a leftover schedule: once suspended, the date has
 * already passed. Purging wins over both: once `purgeAt` is reached the
 * owner can no longer restore it.
 */
export function getDeletionState(
  organisation: Pick<
    OrganisationProfile,
    "suspendedAt" | "deletionScheduledFor" | "purgeAt"
  >,
  now: Date = new Date(),
): OrganisationDeletionState {
  if (
    organisation.purgeAt &&
    new Date(organisation.purgeAt).getTime() <= now.getTime()
  ) {
    return "purging";
  }
  if (organisation.suspendedAt) return "suspended";
  if (organisation.deletionScheduledFor) return "scheduled";
  return "active";
}
