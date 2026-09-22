import { useCurrentOrganisation } from "./useCurrentOrganisation";

/** Whether the caller's role in the current organisation can see other
 * members' data — admin org-wide, manager for their team(s). Mirrors the
 * backend's own admin/manager gate on team-scoped endpoints. */
export function useCanViewOthers(): boolean {
  const organisationQuery = useCurrentOrganisation();
  const role = organisationQuery.data?.role;
  return role === "admin" || role === "manager";
}
