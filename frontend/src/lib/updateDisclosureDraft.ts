import { API_URL } from "./apiUrl";
import type {
  DisclosureDraft,
  UpdateDisclosureDraftResult,
} from "@/types/disclosure";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function updateDisclosureDraft(
  organisationId: number,
  region: string | null,
  text: string,
): Promise<UpdateDisclosureDraftResult> {
  const query = region ? `?region=${encodeURIComponent(region)}` : "";
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/disclosure-versions/draft${query}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
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
