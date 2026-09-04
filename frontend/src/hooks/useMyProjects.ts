import { useQuery } from "@tanstack/react-query";
import { getMyProjects } from "@/lib/getMyProjects";

export const MY_PROJECTS_QUERY_KEY = (organisationId: string) => [
  "projects",
  organisationId,
  "mine",
];

export function useMyProjects(organisationId: string) {
  return useQuery({
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
