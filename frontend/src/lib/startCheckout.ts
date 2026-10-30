import { API_URL } from "./apiUrl";
import type { BillingPeriod } from "./pricing.generated";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Asks the backend for a Stripe-hosted checkout page to send the admin to. */
export async function startCheckout(
  organisationId: number | string,
  period: BillingPeriod,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/billing/checkout`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  const data = (await response.json().catch(() => null)) as {
    url?: string;
    message?: string[] | string;
  } | null;

  if (response.ok && data?.url) {
    return { ok: true, url: data.url };
  }

  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
