import { API_URL } from "./apiUrl";
import type {
  DisclosureDraft,
  GetDisclosureDraftResult,
} from "@/types/disclosure";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getDisclosureDraft(
  organisationId: number,
  region: string | null,
): Promise<GetDisclosureDraftResult> {
  const query = region ? `?region=${encodeURIComponent(region)}` : "";
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/disclosure-versions/draft${query}`,
      { credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const draft = (await response.json()) as DisclosureDraft;
    return { ok: true, draft };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
