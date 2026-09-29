import { useQueryClient } from "@tanstack/react-query";
import { PROJECT_QUERY_KEY } from "@/hooks/useProject";

/** Refetches the projects list and this project's detail after a change
 * to its status (archive/unarchive). */
export function useInvalidateProject(organisationId: string, projectId: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["projects", organisationId] });
    queryClient.invalidateQueries({
      queryKey: PROJECT_QUERY_KEY(organisationId, projectId),
    });
  };
}
