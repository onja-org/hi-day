"use client";

import { BillingConsentNotice } from "./BillingConsentNotice";

type SeatsFullConsentProps = {
  purchasedSeats: number | null;
  agreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
  /**
   * How many people this submission will invite, where that is known — an
   * import from a file. Phrased as what is about to be sent rather than what
   * the file holds, since a failed send resumes with only the remainder.
   */
  invitingCount?: number;
};

/**
 * Asks an admin to agree to the charge before they can invite anybody, once
 * every purchased seat is taken.
 *
 * Lives in the invite forms rather than on the Members page because the
 * charge is immediate (ADR 0033) — a banner is read once and scrolled past,
 * and cannot gate anything. Shown on `seatsAreFull`, true *at* the purchased
 * count, so the agreement is in hand before the first extra seat.
 */
export function SeatsFullConsent({
  purchasedSeats,
  agreed,
  onAgreedChange,
  invitingCount,
}: SeatsFullConsentProps) {
  const seats = purchasedSeats ?? 0;

  // A file of forty people is a different commitment from one invitation,
  // and agreeing to both in the same words understates the bigger one.
  const description =
    invitingCount === undefined
      ? "Anyone who joins from here is an extra seat, charged to the card on file as soon as they accept."
      : `${invitingCount} ${invitingCount === 1 ? "person" : "people"} will be invited. Each one who accepts is an extra seat, charged to the card on file as they join.`;

  return (
    <section
      aria-label="Extra seats will be charged"
      className="rounded-brand-sm border-2 border-ink bg-sun px-4 py-3"
    >
      <BillingConsentNotice
        title={`All ${seats} ${seats === 1 ? "seat" : "seats"} you paid for are in use.`}
        description={description}
        agreed={agreed}
        onAgreedChange={onAgreedChange}
      />
    </section>
  );
}
