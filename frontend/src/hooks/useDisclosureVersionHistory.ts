import { useQuery } from "@tanstack/react-query";
import { getDisclosureVersionHistory } from "@/lib/getDisclosureVersionHistory";

export function disclosureVersionHistoryQueryKey(
  organisationId: number,
  region: string | null,
) {
  return ["disclosure", "history", organisationId, region ?? "default"];
}

export function useDisclosureVersionHistory(
  organisationId: number,
  region: string | null,
) {
  return useQuery({
    queryKey: disclosureVersionHistoryQueryKey(organisationId, region),
    queryFn: async () => {
      const result = await getDisclosureVersionHistory(organisationId, region);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.versions;
    },
  });
}
