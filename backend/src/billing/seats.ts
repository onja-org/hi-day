/**
 * The seat arithmetic, kept free of Nest and TypeORM so the rules are
 * readable and testable on their own.
 */

/**
 * Nobody can buy nothing: a subscription for zero seats is not a
 * subscription, and Stripe refuses a quantity below one anyway.
 */
export const MIN_PURCHASABLE_SEATS = 1;

/**
 * A ceiling, not a product limit — the biggest number an admin could
 * plausibly mean. It exists so a slipped keypress ("1000" for "100", or a
 * pasted phone number) cannot authorise a charge four digits too large
 * before anyone reads it. Past this, the large-team conversation applies
 * (see `PricingLargeTeam`), which is a person, not a form.
 */
export const MAX_PURCHASABLE_SEATS = 10_000;

/**
 * What the Organisation is charged for: the seats it bought, or the people
 * it actually has, whichever is larger.
 *
 * Buying ahead of a hiring round is the point of buying seats at all, so
 * the purchase is a floor rather than a cap. Going past it is explicitly
 * allowed — nothing blocks the extra members and they work normally — and
 * the next invoice simply covers everyone. Billing the smaller number
 * instead would make over-hiring free, and capping it would turn a billing
 * preference into a hiring freeze.
 */
export function billedSeatCount(
  purchasedSeats: number | null,
  activeMemberCount: number,
): number {
  return Math.max(purchasedSeats ?? 0, activeMemberCount);
}

/** Whether there are more people than were paid for. */
export function isOverPurchasedSeats(
  purchasedSeats: number | null,
  activeMemberCount: number,
): boolean {
  return purchasedSeats !== null && activeMemberCount > purchasedSeats;
}

/**
 * Null when the input is not a seat count anybody meant: a fraction, a
 * negative, something that is not a number at all, or a figure past the
 * ceiling. Returning null rather than clamping keeps a typo visible — a
 * silently corrected "99999" would charge for 10,000 and say nothing.
 */
export function parseSeatCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < MIN_PURCHASABLE_SEATS) return null;
  if (value > MAX_PURCHASABLE_SEATS) return null;
  return value;
}

/**
 * Whether the over-seats notice still needs acknowledging.
 *
 * Anchored to the member count it was acknowledged at, not a flag: saying
 * "understood" at 54 members against 50 seats is not saying it about 80
 * against 50, and the figure on the next invoice is not the same figure.
 * Growing further asks again; staying put, or shrinking back inside the
 * purchase, does not.
 */
export function needsOverageAcknowledgement(
  purchasedSeats: number | null,
  activeMemberCount: number,
  acknowledgedAtMembers: number | null,
): boolean {
  if (!isOverPurchasedSeats(purchasedSeats, activeMemberCount)) return false;
  return (
    acknowledgedAtMembers === null || activeMemberCount > acknowledgedAtMembers
  );
}
