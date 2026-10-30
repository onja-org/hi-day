import { API_URL } from "./apiUrl";
import type {
  InvoiceSummary,
  PaidSubscription,
  SeatChangePreview,
} from "@/types/subscription";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

async function call<T>(
  path: string,
  init: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  const data = (await response.json().catch(() => null)) as
    | (T & { message?: string[] | string })
    | null;

  if (response.ok) return { ok: true, data: data as T };

  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}

export function getSubscription(organisationId: number | string) {
  return call<PaidSubscription | null>(
    `/organisations/${organisationId}/billing/subscription`,
    { method: "GET" },
  );
}

export function previewSeatChange(
  organisationId: number | string,
  seats: number,
) {
  return call<SeatChangePreview>(
    `/organisations/${organisationId}/billing/seats/preview`,
    { method: "POST", body: JSON.stringify({ seats }) },
  );
}

export function getInvoices(organisationId: number | string) {
  return call<InvoiceSummary[]>(
    `/organisations/${organisationId}/billing/invoices`,
    { method: "GET" },
  );
}

/**
 * A one-time link into Stripe's Customer Portal, for managing the card, the
 * billing email and the invoice history. `returnUrl` is where Stripe sends
 * them back to when they are done.
 */
export function openBillingPortal(
  organisationId: number | string,
  returnUrl: string,
) {
  return call<{ url: string }>(
    `/organisations/${organisationId}/billing/portal`,
    { method: "POST", body: JSON.stringify({ returnUrl }) },
  );
}
