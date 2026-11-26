import { useQuery } from "@tanstack/react-query";
import { getSummaryEmailPreferences } from "@/lib/getSummaryEmailPreferences";

export const SUMMARY_EMAIL_PREFERENCES_QUERY_KEY = (organisationId: string) => [
  "summary-email-preferences",
  organisationId,
];

/** Your own summary emails in the given organisation. */
export function useSummaryEmailPreferences(organisationId: string | undefined) {
  return useQuery({
    queryKey: SUMMARY_EMAIL_PREFERENCES_QUERY_KEY(organisationId ?? ""),
    enabled: Boolean(organisationId),
    queryFn: async () => {
      const result = await getSummaryEmailPreferences(organisationId!);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.preferences;
    },
  });
}
