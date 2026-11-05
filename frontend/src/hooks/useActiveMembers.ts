import { useQuery } from "@tanstack/react-query";
import { getActiveMembers } from "@/lib/getActiveMembers";

export const ACTIVE_MEMBERS_QUERY_KEY = (
  organisationId: string,
  scope: "visible" | "organisation" = "visible",
) => ["memberships", "active", organisationId, scope];

export function useActiveMembers(
  organisationId: string,
  options: { enabled?: boolean; scope?: "visible" | "organisation" } = {},
) {
  const scope = options.scope ?? "visible";
  return useQuery({
    queryKey: ACTIVE_MEMBERS_QUERY_KEY(organisationId, scope),
    queryFn: async () => {
      const result = await getActiveMembers(organisationId, scope);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.members;
    },
    enabled: options.enabled ?? true,
  });
}
