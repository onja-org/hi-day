import { TRIAL_DAYS } from './trial';

/**
 * What Hi Day Cloud costs, in the shape a payment provider charges in rather
 * than the shape a page displays. Stripe bills an integer amount of minor
 * units against a Price with its own interval, so that is what is canonical
 * here and every displayed figure is derived from it — the opposite way round
 * from how the marketing page used to hold it.
 */
export type BillingPeriod = 'monthly' | 'annual';

export interface CloudPrice {
  /** Per seat, per `interval`, in minor units — 4200 is $42.00. */
  amountMinor: number;
  /** ISO 4217, lowercase, as Stripe wants it. */
  currency: string;
  interval: 'month' | 'year';
}

export const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'annual'];

/**
 * Annual is one yearly charge of $42.00 a seat, not $3.50 billed twelve
 * times: "billed annually" is a single Stripe Price with a yearly interval,
 * and the $3.50 the page advertises is that divided by twelve. Writing it the
 * other way round is how a product ends up advertising one number and
 * charging twelve times another.
 */
export const CLOUD_PRICES: Record<BillingPeriod, CloudPrice> = {
  monthly: { amountMinor: 400, currency: 'usd', interval: 'month' },
  annual: { amountMinor: 4200, currency: 'usd', interval: 'year' },
};

/** What a seat costs per month under this period, in minor units. */
export function monthlyEquivalentMinor(price: CloudPrice): number {
  return price.interval === 'year' ? price.amountMinor / 12 : price.amountMinor;
}

/**
 * Minor units as the page writes them: no trailing `.00`, because "$4.00 per
 * person" reads like a price that wanted more decimals than it had.
 */
export function formatMinor(amountMinor: number, currency: string): string {
  const symbol = currency === 'usd' ? '$' : '';
  const major = amountMinor / 100;
  return `${symbol}${Number.isInteger(major) ? major : major.toFixed(2)}`;
}

/** The per-person-per-month figure the pricing page leads with. */
export function monthlyPriceLabel(period: BillingPeriod): string {
  const price = CLOUD_PRICES[period];
  return formatMinor(monthlyEquivalentMinor(price), price.currency);
}

export const CLOUD_BILLING_NOTE: Record<BillingPeriod, string> = {
  monthly: 'billed monthly',
  annual: 'billed annually',
};

export const TRIAL_PROMISE = `${TRIAL_DAYS}-day free trial, no credit card required.`;

export { TRIAL_DAYS };
