import { API_URL } from "./apiUrl";
import type { GetTrialStatusResult, TrialStatus } from "@/types/billing";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getTrialStatus(
  organisationId: number | string,
): Promise<GetTrialStatusResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${organisationId}/billing/trial`, {
      method: "GET",
      credentials: "include",
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const body = (await response.json()) as { trial: TrialStatus | null };
    return { ok: true, trial: body.trial };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
