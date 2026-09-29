import { useMutation } from "@tanstack/react-query";
import { useInvalidateProject } from "@/hooks/useInvalidateProject";
import { unarchiveProject } from "@/lib/unarchiveProject";

export function useUnarchiveProject(organisationId: string, projectId: string) {
  const invalidate = useInvalidateProject(organisationId, projectId);

  return useMutation({
    mutationFn: () => unarchiveProject(organisationId, projectId),
    onSuccess: (result) => {
      if (result.ok) {
        invalidate();
      }
    },
  });
}
