import type {
  OrganisationDeletionState,
  OrganisationProfile,
} from "@/types/organisation";

/** Suspension wins over a leftover schedule: once suspended, the date has already passed. */
export function getDeletionState(
  organisation: Pick<OrganisationProfile, "suspendedAt" | "deletionScheduledFor">,
): OrganisationDeletionState {
  if (organisation.suspendedAt) return "suspended";
  if (organisation.deletionScheduledFor) return "scheduled";
  return "active";
}
