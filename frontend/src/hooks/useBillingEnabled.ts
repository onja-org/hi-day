"use client";

import { useQuery } from "@tanstack/react-query";
import { getPublicConfig } from "@/lib/getPublicConfig";
import { DEFAULT_PUBLIC_CONFIG } from "@/lib/publicConfig";

export const publicConfigQueryKey = ["public-config"];

/**
 * Fetched once — the answer belongs to the deployment, not the session.
 * False while loading and false on failure, so nothing billing-shaped ever
 * flashes on an install that has none, and no caller needs a loading state.
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
