"use client";

import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/lib/subscriptionApi";
import { useCurrentOrganisation } from "./useCurrentOrganisation";

export const invoicesQueryKey = (organisationId: number | string) => [
  "billing",
  "invoices",
  String(organisationId),
];

/** Invoices straight from Stripe, newest first. Admin-only, like the rest. */
export function useInvoices(organisationId: number | string) {
  const organisationQuery = useCurrentOrganisation();

  return useQuery({
    queryKey: invoicesQueryKey(organisationId),
    enabled: organisationQuery.data?.role === "admin",
    queryFn: async () => {
      const result = await getInvoices(organisationId);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });
}
