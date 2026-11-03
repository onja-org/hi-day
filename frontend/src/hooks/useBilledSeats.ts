import { useQuery } from "@tanstack/react-query";
import { getBilledSeats } from "@/lib/getBilledSeats";
import { useBillingEnabled } from "./useBillingEnabled";
import { useCurrentOrganisation } from "./useCurrentOrganisation";

export const billedSeatsQueryKey = (organisationId: number | string) => [
  "billing",
  "seats",
  String(organisationId),
];

/** Admin-only, like the rest of billing. Not requested at all where billing
 * is off: the route is not registered, so the call could only 404. */
export function useBilledSeats(organisationId: number | string) {
  const organisationQuery = useCurrentOrganisation();
  const billingEnabled = useBillingEnabled();

  return useQuery({
    queryKey: billedSeatsQueryKey(organisationId),
    enabled: billingEnabled && organisationQuery.data?.role === "admin",
    queryFn: async () => {
      const result = await getBilledSeats(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.seats;
    },
  });
}
