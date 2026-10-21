import type { BillingPeriod, CloudPrice } from './pricing';

/** One Stripe Price as far as the check below is concerned. */
export interface StripePriceShape {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string } | null;
}

export interface PriceMismatch {
  period: BillingPeriod;
  priceId: string;
  expected: string;
  found: string;
}

function describe(
  amountMinor: number,
  currency: string,
  interval: string,
): string {
  return `${amountMinor} ${currency}/${interval}`;
}

/**
 * Whether a Stripe Price charges what the backend advertises.
 *
 * Stripe bills against its own Price objects, so nothing stops one being
 * edited to a different amount than the page quotes — and the first anyone
 * would know is a customer charged the wrong figure. Checked rather than
 * assumed, at boot, where it is a refusal to start instead of a silent
 * overcharge.
 */
export function findPriceMismatch(
  period: BillingPeriod,
  expected: CloudPrice,
  found: StripePriceShape,
): PriceMismatch | null {
  const foundDescription = describe(
    found.unit_amount ?? 0,
    found.currency,
    found.recurring?.interval ?? 'one-off',
  );
  const expectedDescription = describe(
    expected.amountMinor,
    expected.currency,
    expected.interval,
  );

  return foundDescription === expectedDescription
    ? null
    : {
        period,
        priceId: found.id,
        expected: expectedDescription,
        found: foundDescription,
      };
}

export function describeMismatches(mismatches: PriceMismatch[]): string {
  return mismatches
    .map(
      (m) =>
        `${m.period} (${m.priceId}): Stripe charges ${m.found}, this app advertises ${m.expected}`,
    )
    .join('; ');
}
