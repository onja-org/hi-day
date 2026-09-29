import { useQuery } from "@tanstack/react-query";
import { getInviteLinks } from "@/lib/getInviteLinks";

export const INVITE_LINKS_QUERY_KEY = (organisationId: string) => [
  "invite-links",
  organisationId,
];

export function useInviteLinks(organisationId: string) {
  return useQuery({
    queryKey: INVITE_LINKS_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getInviteLinks(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.inviteLinks;
    },
  });
}
