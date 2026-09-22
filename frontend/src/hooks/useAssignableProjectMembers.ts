import { useQuery } from "@tanstack/react-query";
import { getAssignableProjectMembers } from "@/lib/getAssignableProjectMembers";

export const ASSIGNABLE_PROJECT_MEMBERS_QUERY_KEY = (
  organisationId: string,
  projectId?: string,
) => ["projects", organisationId, projectId ?? "new", "assignable-members"];

export function useAssignableProjectMembers(
  organisationId: string,
  projectId?: string,
) {
  return useQuery({
    queryKey: ASSIGNABLE_PROJECT_MEMBERS_QUERY_KEY(organisationId, projectId),
    queryFn: async () => {
      const result = await getAssignableProjectMembers(organisationId, projectId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.members;
    },
  });
}
