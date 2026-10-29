"use client";

import { useQuery } from "@tanstack/react-query";
import { getSubscription } from "@/lib/subscriptionApi";
import { useCurrentOrganisation } from "./useCurrentOrganisation";

export const subscriptionQueryKey = (organisationId: number | string) => [
  "billing",
  "subscription",
  String(organisationId),
];

/**
 * The paid subscription, straight from Stripe. Null for an organisation
 * that has not paid, which is the Billing page's signal to show the trial
 * card instead. Admin-only, like the rest of billing.
 */
export function useSubscription(organisationId: number | string) {
  const organisationQuery = useCurrentOrganisation();

  return useQuery({
    queryKey: subscriptionQueryKey(organisationId),
    enabled: organisationQuery.data?.role === "admin",
    queryFn: async () => {
      const result = await getSubscription(organisationId);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}
