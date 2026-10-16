import { useQuery } from "@tanstack/react-query";
import { useProjectsEnabled } from "@/hooks/useProjectsEnabled";
import { getMyProjects } from "@/lib/getMyProjects";

export const MY_PROJECTS_QUERY_KEY = (organisationId: string) => [
  "projects",
  organisationId,
  "mine",
];

/** Idle while the organisation has Projects off: the endpoint refuses, and
 * there is nothing to list. Callers see `data` undefined, as when loading. */
export function useMyProjects(organisationId: string) {
  const projectsEnabled = useProjectsEnabled();

  return useQuery({
    enabled: projectsEnabled,
    queryKey: MY_PROJECTS_QUERY_KEY(organisationId),
    queryFn: async () => {
      const result = await getMyProjects(organisationId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.projects;
    },
  });
}
