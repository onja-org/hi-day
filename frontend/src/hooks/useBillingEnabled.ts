"use client";

import { useQuery } from "@tanstack/react-query";
import { getPublicConfig } from "@/lib/getPublicConfig";
import { DEFAULT_PUBLIC_CONFIG } from "@/lib/publicConfig";

export const publicConfigQueryKey = ["public-config"];

/**
 * Whether this installation bills anybody — the one question every billing
 * surface asks before it draws.
 *
 * Fetched once and never again: the answer belongs to the deployment, not
 * the session, so refetching it on focus or reconnect would spend requests
 * on something that cannot change without a restart.
 *
 * Returns `false` while it is still loading, and `false` if the request
 * fails. Both mean the same thing on screen — no billing UI — which is the
 * right way round: a self-hoster must never glimpse a paywall, whereas a
 * Cloud admin briefly not seeing the Billing link costs nothing. It also
 * means no caller needs a loading state for this.
 */
export function useBillingEnabled(): boolean {
  const { data } = useQuery({
    queryKey: publicConfigQueryKey,
    queryFn: getPublicConfig,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  return (data ?? DEFAULT_PUBLIC_CONFIG).billingEnabled;
}
