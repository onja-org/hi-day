import { useQuery } from "@tanstack/react-query";
import { getDisclosureDraft } from "@/lib/getDisclosureDraft";

export function disclosureDraftQueryKey(
  organisationId: number,
  region: string | null,
) {
  return ["disclosure", "draft", organisationId, region ?? "default"];
}

export function useDisclosureDraft(
  organisationId: number,
  region: string | null,
) {
  return useQuery({
    queryKey: disclosureDraftQueryKey(organisationId, region),
    queryFn: async () => {
      const result = await getDisclosureDraft(organisationId, region);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.draft;
    },
  });
}
