import { useCurrentOrganisation } from "./useCurrentOrganisation";

/** Whether the caller may see other members' data — an admin org-wide, and
 * whoever manages a team for that team. Resolved by the backend, because
 * the role alone does not say: managing a team is the grant. */
export function useCanViewOthers(): boolean {
  return useCurrentOrganisation().data?.canViewOthers ?? false;
}
