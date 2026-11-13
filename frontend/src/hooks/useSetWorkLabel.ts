"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WORK_USAGE_QUERY_KEY } from "@/hooks/useWorkUsage";
import { setWorkLabel } from "@/lib/setWorkLabel";
import type { SetWorkLabelInput, WorkUsageItem } from "@/types/workClassification";

/**
 * Labels an app or site, showing the new label straight away and rolling
 * back if the server refuses. Performance figures are refetched after,
 * since a label changes past dates too.
 */
export function useSetWorkLabel(organisationId: string) {
  const queryClient = useQueryClient();
  const queryKey = WORK_USAGE_QUERY_KEY(organisationId);

  return useMutation({
    mutationFn: async (input: SetWorkLabelInput) => {
      const result = await setWorkLabel(organisationId, input);
      if (!result.ok) throw new Error(result.message);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkUsageItem[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<WorkUsageItem[]>(
          queryKey,
          previous.map((item) =>
            item.kind === input.kind && item.name === input.name ? { ...item, label: input.label } : item,
          ),
        );
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["insights", "performance"] });
    },
  });
}
