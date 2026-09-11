import { useQuery } from "@tanstack/react-query";
import { getMyScreenshots } from "@/lib/getMyScreenshots";

export const MY_SCREENSHOTS_QUERY_KEY = (organisationId: string) => [
  "screenshots",
  "mine",
  organisationId,
];

export function useMyScreenshots(organisationId: string) {
  return useQuery({
    queryKey: MY_SCREENSHOTS_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getMyScreenshots(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.screenshots;
    },
  });
}
