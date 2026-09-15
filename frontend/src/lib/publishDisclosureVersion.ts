import { API_URL } from "./apiUrl";
import type {
  DisclosureDraft,
  PublishDisclosureVersionResult,
} from "@/types/disclosure";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function publishDisclosureVersion(
  organisationId: number,
  region: string | null,
): Promise<PublishDisclosureVersionResult> {
  const query = region ? `?region=${encodeURIComponent(region)}` : "";
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/disclosure-versions/publish${query}`,
      { method: "POST", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const version = (await response.json()) as DisclosureDraft;
    return { ok: true, version };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
