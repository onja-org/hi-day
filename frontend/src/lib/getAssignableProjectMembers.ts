import { API_URL } from "./apiUrl";
import type { GetAssignableMembersResult } from "@/types/assignableMember";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getAssignableProjectMembers(
  organisationId: string,
  projectId: string,
): Promise<GetAssignableMembersResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/${projectId}/assignable-members`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const members = await response.json();
    return { ok: true, members };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
