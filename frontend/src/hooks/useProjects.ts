import { useQuery } from "@tanstack/react-query";
import type { GetProjectsFilter } from "@/lib/getProjects";
import { getProjects } from "@/lib/getProjects";

export const PROJECTS_QUERY_KEY = (
  organisationId: string,
  filter: GetProjectsFilter = {},
) => ["projects", organisationId, filter];

export function useProjects(
  organisationId: string,
  filter: GetProjectsFilter = {},
) {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY(organisationId, filter),
    queryFn: async () => {
      const result = await getProjects(organisationId, filter);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.projects;
    },
  });
}
