import { CLOUD_AMOUNT_MINOR, CLOUD_CURRENCY } from "./pricing.generated";

const MONTHS_PER_YEAR = 12;

/**
 * What a given number of seats costs each way, so the billing page can show
 * its working rather than one figure the reader has to trust.
 *
 * Every number is derived from `CLOUD_AMOUNT_MINOR`, which the generator
 * writes from the backend's `CLOUD_PRICES` — the same integers Stripe
 * charges. Nothing here is a typed-in price, because a page that quotes one
 * figure while the invoice says another is worse than a page with no figures.
 *
 * Minor units throughout: money in floats accumulates error, and a cent of
 * drift in a total shown next to its own breakdown is a visible bug.
 */
export type SeatPricing = {
  seats: number;
  annual: {
    /** One yearly charge. */
    totalMinor: number;
    /** That total spread over the year — a comparison, never a charge. */
    perMonthMinor: number;
    perSeatPerMonthMinor: number;
  };
  monthly: {
    /** One monthly charge. */
    totalMinor: number;
    /** Twelve of them, for comparing against the annual total. */
    over12MonthsMinor: number;
    perSeatMinor: number;
  };
  /** What choosing annual keeps, across a year. */
  savingPerYearMinor: number;
};

export function seatPricing(seats: number): SeatPricing {
  // `CLOUD_AMOUNT_MINOR.annual` is per seat per *year*; monthly is per seat
  // per month. Mixing the two up is how a page advertises one number and
  // charges twelve times another.
  const annualTotal = CLOUD_AMOUNT_MINOR.annual * seats;
  const monthlyTotal = CLOUD_AMOUNT_MINOR.monthly * seats;
  const monthlyOverAYear = monthlyTotal * MONTHS_PER_YEAR;

  return {
    seats,
    annual: {
      totalMinor: annualTotal,
      perMonthMinor: Math.round(annualTotal / MONTHS_PER_YEAR),
      perSeatPerMonthMinor: Math.round(
        CLOUD_AMOUNT_MINOR.annual / MONTHS_PER_YEAR,
      ),
    },
    monthly: {
      totalMinor: monthlyTotal,
      over12MonthsMinor: monthlyOverAYear,
      perSeatMinor: CLOUD_AMOUNT_MINOR.monthly,
    },
    savingPerYearMinor: monthlyOverAYear - annualTotal,
  };
}

/** Always two decimals here, unlike the pricing page's trimmed headline
 * figures: these sit in a column of sums that should line up. */
export function formatMoney(amountMinor: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: CLOUD_CURRENCY.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/**
 * How far through the trial today is, 0 to 1, for the bar on the billing
 * page. Clamped at both ends: an expired trial reads as full rather than
 * overflowing, and a clock behind the start reads as empty rather than
 * negative.
 */
export function trialProgressFraction(
  startedAt: string,
  endsAt: string,
  now: Date = new Date(),
): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;
  const elapsed = (now.getTime() - start) / (end - start);
  return Math.min(Math.max(elapsed, 0), 1);
}

/**
 * When the charge after this one falls. Mirrors the backend's
 * `nextPaymentFrom` so the modal can name a date before a subscription
 * exists to read `currentPeriodEnd` off; once one does, Stripe's own date is
 * what every surface reads and this is not consulted again.
 *
 * `setMonth`/`setFullYear` rather than adding days: months are not 30 days
 * and years are not 365, and a renewal date that drifts a day a cycle is a
 * support ticket.
 */
export function nextPaymentFrom(from: Date, period: "monthly" | "annual"): Date {
  const next = new Date(from.getTime());
  if (period === "annual") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}
