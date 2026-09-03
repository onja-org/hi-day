import { useQuery } from "@tanstack/react-query";
import { getProjectTasks } from "@/lib/getProjectTasks";

export const PROJECT_TASKS_QUERY_KEY = (
  organisationId: string,
  projectId: string,
) => ["projects", organisationId, projectId, "tasks"];

export function useProjectTasks(organisationId: string, projectId: string) {
  return useQuery({
    queryKey: PROJECT_TASKS_QUERY_KEY(organisationId, projectId),
    queryFn: async () => {
      const result = await getProjectTasks(organisationId, projectId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
  });
}
