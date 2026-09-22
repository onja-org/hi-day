import { useQuery } from "@tanstack/react-query";
import { getProject } from "@/lib/getProject";

export const PROJECT_QUERY_KEY = (organisationId: string, projectId: string) => [
  "projects",
  organisationId,
  projectId,
];

export function useProject(
  organisationId: string,
  projectId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: PROJECT_QUERY_KEY(organisationId, projectId),
    queryFn: async () => {
      const result = await getProject(organisationId, projectId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.project;
    },
    enabled: options.enabled ?? true,
  });
}
