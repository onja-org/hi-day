import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setAutoRenew } from "@/lib/subscriptionApi";
import { subscriptionQueryKey } from "./useSubscription";
import { trialStatusQueryKey } from "./useTrialStatus";

/**
 * Turns auto-renew off ("Cancel subscription") or back on ("Keep
 * subscription"). Resolves to the API result rather than throwing, so the
 * caller can show the server's own reason when it refuses.
 */
export function useSetAutoRenew(organisationId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (on: boolean) => setAutoRenew(organisationId, on),
    onSuccess: (result) => {
      if (!result.ok) return;
      // The card and the banner both read when access ends.
      void queryClient.invalidateQueries({
        queryKey: subscriptionQueryKey(organisationId),
      });
      void queryClient.invalidateQueries({
        queryKey: trialStatusQueryKey(organisationId),
      });
    },
  });
}
