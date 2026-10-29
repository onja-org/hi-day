"use client";

import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBilledSeats, billedSeatsQueryKey } from "@/hooks/useBilledSeats";
import { acknowledgeSeatOverage } from "@/lib/setBilledSeats";
import { BillingConsentPanel } from "./billing/BillingConsentPanel";

type SeatsExceededBannerProps = {
  organisationId: number | string;
};

/**
 * Asks an admin to acknowledge that the team has outgrown the seats it pays
 * for, where they are adding people and so can act on it.
 *
 * Deliberately **not a gate**: extra members are allowed, work normally, and
 * are covered by the next payment (`max(purchased, members)`). The thing
 * worth preventing is not the hire — it is somebody finding out about it on
 * an invoice.
 *
 * It returns if the team grows further: the acknowledgement is stamped with
 * the member count it was given at, because agreeing to 54 against 50 seats
 * is not agreeing to 80 against 50.
 *
 * Admins only — `useBilledSeats` makes no request for anyone else. Counting
 * **active members**, not pending invitations: nobody is billed for an
 * invitation, so this and the invoice count the same thing.
 */
export function SeatsExceededBanner({ organisationId }: SeatsExceededBannerProps) {
  const seatsQuery = useBilledSeats(organisationId);
  const queryClient = useQueryClient();
  const seats = seatsQuery.data;

  const acknowledge = useMutation({
    mutationFn: () => acknowledgeSeatOverage(organisationId),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      queryClient.setQueryData(billedSeatsQueryKey(organisationId), result.seats);
      void queryClient.invalidateQueries({
        queryKey: billedSeatsQueryKey(organisationId),
      });
    },
  });

  if (!seats?.needsOverageAcknowledgement || seats.purchasedSeats === null) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-label="Purchased seats exceeded"
      className="mb-6"
    >
      {/* No Cancel: there is nothing to back out of. The members are already
          here and the bill already covers them. */}
      <BillingConsentPanel
        title={`You only purchased ${seats.purchasedSeats} ${seats.purchasedSeats === 1 ? "seat" : "seats"}.`}
        description="If you keep adding new members, it will affect your billing on the next payment."
        confirmLabel="Got it"
        onConfirm={() => acknowledge.mutate()}
        busy={acknowledge.isPending}
      />
    </aside>
  );
}
