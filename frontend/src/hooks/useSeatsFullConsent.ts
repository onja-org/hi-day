"use client";

import { useState } from "react";
import { useBilledSeats } from "./useBilledSeats";
import { useBillingEnabled } from "./useBillingEnabled";

/**
 * Whether inviting anyone right now costs money, and whether an admin has
 * said they know it. `blocked` is what a submit button disables on.
 *
 * False whenever the figures are unavailable — the query is admin-only, so
 * for a manager it never resolves. Deliberate: blocking a manager from
 * inviting over a billing request they are not allowed to make would break
 * the page, and the seat is charged either way.
 *
 * False for the same reason, and more simply, where billing is off: nobody
 * is charged for arriving, so there is nothing to consent to. Gating here
 * rather than in each form is what keeps the three invite surfaces — the
 * member form, the invite-link modal and the member import — free of the
 * flag: all three read `required`, and all three go quiet together.
 */
export function useSeatsFullConsent(organisationId: string) {
  const seatsQuery = useBilledSeats(organisationId);
  const billingEnabled = useBillingEnabled();
  const [agreed, setAgreed] = useState(false);

  const seats = seatsQuery.data;
  const required = billingEnabled && Boolean(seats?.seatsAreFull);

  return {
    /** Show the notice: every purchased seat is taken. */
    required,
    agreed,
    setAgreed,
    /** Consent is needed and has not been given — hold the submit. */
    blocked: required && !agreed,
    purchasedSeats: seats?.purchasedSeats ?? null,
  };
}
