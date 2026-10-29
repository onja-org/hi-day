import { API_URL } from "./apiUrl";
import type { BillingPeriod } from "./pricing.generated";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** What the modal confirms a card against — see the backend's SubscriptionIntent. */
export type SubscriptionIntent = {
  clientSecret: string;
  seats: number;
  period: BillingPeriod;
  amountMinor: number;
  /** Taken today, in full: paying ends the trial there and then. */
  chargedTodayMinor: number;
  /** ISO, when the next charge falls — a month or a year from today. */
  nextPaymentAt: string;
  currency: string;
};

/**
 * Creates the subscription Stripe is waiting to collect on, and returns the
 * secret Elements confirms the card against. Called at the moment Confirm is
 * pressed rather than when the modal opens: a subscription per flip of the
 * Monthly/Annual toggle would leave a trail of incomplete ones in Stripe.
 */
export async function createSubscriptionIntent(
  organisationId: number | string,
  period: BillingPeriod,
  /**
   * What the modal displayed. The server charges its own count and refuses
   * the request if the two differ, so the amount on screen is the only
   * amount that can be taken.
   */
  seats: number,
): Promise<{ ok: true; intent: SubscriptionIntent } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/billing/payment-intent`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, seats }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  const data = (await response.json().catch(() => null)) as
    | (Partial<SubscriptionIntent> & { message?: string[] | string })
    | null;

  if (response.ok && data?.clientSecret) {
    return { ok: true, intent: data as SubscriptionIntent };
  }

  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
