import { useQuery } from "@tanstack/react-query";
import { getDevices } from "@/lib/getDevices";

export const DEVICES_QUERY_KEY = (organisationId: string) => [
  "devices",
  organisationId,
];

export function useDevices(organisationId: string) {
  return useQuery({
    queryKey: DEVICES_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getDevices(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.devices;
    },
  });
}
