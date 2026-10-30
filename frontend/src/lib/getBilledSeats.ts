import { API_URL } from "./apiUrl";
import type { BilledSeats, GetBilledSeatsResult } from "@/types/billing";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getBilledSeats(
  organisationId: number | string,
): Promise<GetBilledSeatsResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/billing/seats`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    return { ok: true, seats: (await response.json()) as BilledSeats };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
