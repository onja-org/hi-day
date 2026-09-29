import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROJECT_TASKS_QUERY_KEY } from "@/hooks/useProjectTasks";
import { setTaskStage } from "@/lib/setTaskStage";
import type { ProjectTasksList, TaskStage } from "@/types/task";

/**
 * Moves a task to a stage, updating the cached list straight away so a
 * dropped Kanban card doesn't snap back while the request is in flight —
 * rolled back if the server refuses, then refetched either way.
 */
export function useSetTaskStage(organisationId: string, projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = PROJECT_TASKS_QUERY_KEY(organisationId, projectId);

  return useMutation({
    mutationFn: ({ taskId, stage }: { taskId: string; stage: TaskStage }) =>
      setTaskStage(organisationId, projectId, taskId, stage),
    onMutate: async ({ taskId, stage }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProjectTasksList>(queryKey);
      if (previous) {
        queryClient.setQueryData<ProjectTasksList>(queryKey, {
          ...previous,
          tasks: previous.tasks.map((task) =>
            task.id === taskId
              ? { ...task, stage, status: stage === "done" ? "closed" : "open" }
              : task,
          ),
        });
      }
      return { previous };
    },
    onSuccess: (result, _variables, context) => {
      if (!result.ok && context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
