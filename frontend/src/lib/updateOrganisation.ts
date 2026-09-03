import { API_URL } from "./apiUrl";
import type {
  OrganisationProfile,
  UpdateOrganisationInput,
  UpdateOrganisationResult,
} from "@/types/organisation";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function updateOrganisation(
  id: number,
  input: UpdateOrganisationInput,
): Promise<UpdateOrganisationResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/organisations/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const organisation = (await response.json()) as OrganisationProfile;
    return { ok: true, organisation };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
