import { useQuery } from "@tanstack/react-query";
import { getTrialStatus } from "@/lib/getTrialStatus";
import { useCurrentOrganisation } from "./useCurrentOrganisation";

export const trialStatusQueryKey = (organisationId: number | string) => [
  "billing",
  "trial",
  String(organisationId),
];

/**
 * The organisation's trial, for an admin. Billing is admin-only on the
 * backend, so the request is never made for anyone else — a manager or member
 * would only earn a 403.
 *
 * `trial` is null where the organisation was created before trials existed,
 * and `isFree` marks one that never pays — either way there is no countdown
 * to show.
 */
export function useTrialStatus(organisationId: number | string) {
  const organisationQuery = useCurrentOrganisation();
  const isAdmin = organisationQuery.data?.role === "admin";

  return useQuery({
    queryKey: trialStatusQueryKey(organisationId),
    enabled: isAdmin,
    queryFn: async () => {
      const result = await getTrialStatus(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.status;
    },
  });
}
