import { useQuery } from "@tanstack/react-query";
import { getPendingInvitations } from "@/lib/getPendingInvitations";

export const PENDING_INVITATIONS_QUERY_KEY = (organisationId: string) => [
  "invitations",
  "pending",
  organisationId,
];

export function usePendingInvitations(
  organisationId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: PENDING_INVITATIONS_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getPendingInvitations(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.invitations;
    },
      enabled: options.enabled ?? true,
  });
}
