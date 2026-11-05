import { useCurrentOrganisation } from "./useCurrentOrganisation";

/** Whether the caller is an admin of the current organisation. Mirrors the
 * backend's admin-only gates — inviting people into the organisation among
 * them, which a manager may not do. */
export function useIsAdmin(): boolean {
  return useCurrentOrganisation().data?.role === "admin";
}
