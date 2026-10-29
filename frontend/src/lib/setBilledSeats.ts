import { API_URL } from "./apiUrl";
import type { BilledSeats, SetBilledSeatsResult } from "@/types/billing";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Records how many seats the organisation has bought. Not a cap — the
 * backend bills `max(purchased, members)` — so this changes the next
 * invoice, never who may join.
 */
export async function setBilledSeats(
  organisationId: number | string,
  seats: number,
): Promise<SetBilledSeatsResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/billing/seats`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats }),
      },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  const data = (await response.json().catch(() => null)) as
    | (Partial<BilledSeats> & { message?: string[] | string })
    | null;

  if (response.ok && typeof data?.count === "number") {
    return {
      ok: true,
      seats: data as BilledSeats,
      message: `Saved — you're paying for ${data.count} ${data.count === 1 ? "seat" : "seats"}.`,
    };
  }

  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}

/**
 * Records that an admin understands going over their seats changes the next
 * invoice. Not a gate: members can be added over the limit either way, and
 * this only stops the notice repeating itself.
 */
export async function acknowledgeSeatOverage(
  organisationId: number | string,
): Promise<SetBilledSeatsResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/billing/seats/acknowledge-overage`,
      { method: "POST", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  const data = (await response.json().catch(() => null)) as
    | (Partial<BilledSeats> & { message?: string[] | string })
    | null;

  if (response.ok && typeof data?.count === "number") {
    return { ok: true, seats: data as BilledSeats, message: "Thanks — noted." };
  }

  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
