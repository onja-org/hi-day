import { TRIAL_DAYS } from './trial';

/**
 * What Hi Day Cloud costs, in the shape Stripe charges in rather than the
 * shape a page displays: an integer of minor units against a Price with its
 * own interval. Every displayed figure is derived from it.
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
 * times — the $3.50 the page leads with is this divided by twelve. Writing it
 * the other way round advertises one number and charges twelve times another.
 */
export const CLOUD_PRICES: Record<BillingPeriod, CloudPrice> = {
  monthly: { amountMinor: 400, currency: 'usd', interval: 'month' },
  annual: { amountMinor: 4200, currency: 'usd', interval: 'year' },
};

/** What a seat costs per month under this period, in minor units. */
export function monthlyEquivalentMinor(price: CloudPrice): number {
  return price.interval === 'year' ? price.amountMinor / 12 : price.amountMinor;
}

/** No trailing `.00`: "$4.00 per person" reads like a price missing digits. */
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

/**
 * How much cheaper annual is than paying monthly for a year, as a whole
 * percent. Derived rather than written down: $4.00 x 12 against $42.00 is
 * 12.5%, and a hand-typed "12%" beside prices that later move is how a
 * pricing page starts lying. Floored, so the figure is never a claim the
 * prices do not support.
 */
export function annualSavingPercent(): number {
  const monthlyForAYear = CLOUD_PRICES.monthly.amountMinor * 12;
  const annual = CLOUD_PRICES.annual.amountMinor;
  return Math.floor(((monthlyForAYear - annual) / monthlyForAYear) * 100);
}

/**
 * When the charge after this one falls: a month or a year on, by the
 * cycle. Used to promise a renewal date in the payment modal before Stripe
 * has a subscription to read `currentPeriodEnd` off — after that, Stripe's
 * own date is authoritative and this is not consulted again.
 *
 * `setMonth`/`setFullYear` rather than adding days: months are not 30 days
 * and years are not 365, and a renewal date that drifts by a day each cycle
 * is a support ticket.
 */
export function nextPaymentFrom(from: Date, period: BillingPeriod): Date {
  const next = new Date(from.getTime());
  if (period === 'annual') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export const CLOUD_BILLING_NOTE: Record<BillingPeriod, string> = {
  monthly: 'billed monthly',
  annual: 'billed annually',
};

export const TRIAL_PROMISE = `${TRIAL_DAYS}-day free trial, no credit card required.`;

export { TRIAL_DAYS };
