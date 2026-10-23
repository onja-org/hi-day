import { useQuery } from "@tanstack/react-query";
import { getBilledSeats } from "@/lib/getBilledSeats";
import { useCurrentOrganisation } from "./useCurrentOrganisation";

export const billedSeatsQueryKey = (organisationId: number | string) => [
  "billing",
  "seats",
  String(organisationId),
];

/** Admin-only, like the rest of billing: the endpoint refuses anyone else. */
export function useBilledSeats(organisationId: number | string) {
  const organisationQuery = useCurrentOrganisation();

  return useQuery({
    queryKey: billedSeatsQueryKey(organisationId),
    enabled: organisationQuery.data?.role === "admin",
    queryFn: async () => {
      const result = await getBilledSeats(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.seats;
    },
  });
}
